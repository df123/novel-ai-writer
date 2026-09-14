// Public Web V1 安全边界测试（设计书 §48 验收矩阵的可自动化部分）
// 本文件在 APP_MODE=public 下启动独立应用实例，验证：
// 认证/会话/CSRF/Origin/密钥脱敏/SSRF 收敛/db 端点不注册/尺寸白名单/安全头/登录限流
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomBytes, scryptSync } from 'crypto';

// 先于 createApp 执行的环境装配（config 均为惰性读取，此处设置即生效）
const WEB_USERNAME = 'owner';
const WEB_PASSWORD = 'correct-password-123';
const WEB_PUBLIC_URL = 'https://writer.example.com';

function makeScryptHash(password: string): string {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

process.env.APP_MODE = 'public';
process.env.NODE_ENV = 'production';
process.env.WEB_PUBLIC_URL = WEB_PUBLIC_URL;
process.env.WEB_USERNAME = WEB_USERNAME;
process.env.WEB_PASSWORD_HASH = makeScryptHash(WEB_PASSWORD);
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes!!';

const { initDB } = await import('../../src/server/db');
const { createApp } = await import('../../src/server/app');
const { resetRateLimiter } = await import('../../src/server/web/webRateLimit');
const { validatePublicStartup } = await import('../../src/server/config');

import type { Express } from 'express';

let app: Express;

/** 从 Set-Cookie 头解析会话令牌 */
function extractSessionToken(setCookie: string | string[] | undefined): string | null {
  const raw = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
  if (!raw) return null;
  const match = raw.match(/__Host-nw_session=([^;]+)/);
  return match ? match[1] : null;
}

interface LoginState {
  cookie: string;
  csrfToken: string;
}

async function login(xffIp = '10.1.0.1'): Promise<LoginState> {
  const response = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', xffIp)
    .set('Origin', WEB_PUBLIC_URL)
    .send({ username: WEB_USERNAME, password: WEB_PASSWORD });
  expect(response.status).toBe(200);
  const token = extractSessionToken(response.headers['set-cookie']);
  expect(token).toBeTruthy();
  return { cookie: `__Host-nw_session=${token}`, csrfToken: response.body.csrfToken };
}

beforeAll(async () => {
  resetRateLimiter();
  await initDB();
  app = createApp();
});

describe('Web 认证（设计书 §13/§14）', () => {
  it('未登录探测会话 → 200 + authenticated:false（不返回 401）', async () => {
    const response = await request(app).get('/api/auth/session');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: false, appMode: 'public' });
  });

  it('未登录访问业务 API → 401', async () => {
    const response = await request(app).get('/api/projects');
    expect(response.status).toBe(401);
  });

  it('错误密码 → 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.2.0.1')
      .set('Origin', WEB_PUBLIC_URL)
      .send({ username: WEB_USERNAME, password: 'wrong' });
    expect(response.status).toBe(401);
  });

  it('登录成功 → __Host- HttpOnly Secure SameSite=Strict Cookie + csrfToken', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.2.0.2')
      .set('Origin', WEB_PUBLIC_URL)
      .send({ username: WEB_USERNAME, password: WEB_PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(true);
    expect(typeof response.body.csrfToken).toBe('string');
    expect(response.body.appMode).toBe('public');

    const setCookie = (response.headers['set-cookie'] as string[]).join(';');
    expect(setCookie).toContain('__Host-nw_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
  });

  it('带会话 Cookie 探测 → authenticated:true；业务 API 可读', async () => {
    const { cookie } = await login('10.2.0.3');
    const probe = await request(app).get('/api/auth/session').set('Cookie', cookie);
    expect(probe.status).toBe(200);
    expect(probe.body.authenticated).toBe(true);
    expect(typeof probe.body.csrfToken).toBe('string');

    const projects = await request(app).get('/api/projects').set('Cookie', cookie);
    expect(projects.status).toBe(200);
  });

  it('注销（需 CSRF）→ 会话立即失效', async () => {
    const { cookie, csrfToken } = await login('10.2.0.4');
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL);
    expect(logout.status).toBe(200);

    const after = await request(app).get('/api/projects').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });

  it('同 IP 连续 5 次登录失败 → 第 6 次 429（不永久锁号）', async () => {
    const ip = '10.3.0.9';
    for (let i = 0; i < 5; i += 1) {
      const fail = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .set('Origin', WEB_PUBLIC_URL)
        .send({ username: WEB_USERNAME, password: `bad-${i}` });
      expect(fail.status).toBe(401);
    }
    const blocked = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ username: WEB_USERNAME, password: WEB_PASSWORD });
    expect(blocked.status).toBe(429);
    // 其他 IP 不受影响
    const other = await login('10.3.0.10');
    expect(other.cookie).toBeTruthy();
  });
});

describe('CSRF 与 Origin（设计书 §15）', () => {
  it('写操作缺少 X-CSRF-Token → 403', async () => {
    const { cookie } = await login('10.4.0.1');
    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ title: 'csrf-missing' });
    expect(response.status).toBe(403);
  });

  it('错误的 CSRF 令牌 → 403', async () => {
    const { cookie } = await login('10.4.0.2');
    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', 'forged-token')
      .set('Origin', WEB_PUBLIC_URL)
      .send({ title: 'csrf-wrong' });
    expect(response.status).toBe(403);
  });

  it('外来 Origin → 403', async () => {
    const { cookie, csrfToken } = await login('10.4.0.3');
    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', 'https://evil.example.net')
      .send({ title: 'origin-evil' });
    expect(response.status).toBe(403);
  });

  it('正确会话 + CSRF + Origin → 写入成功', async () => {
    const { cookie, csrfToken } = await login('10.4.0.4');
    const created = await request(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ title: 'csrf-ok-project', description: 'public security test' });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('csrf-ok-project');

    const removed = await request(app)
      .delete(`/api/projects/${created.body.id}`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL);
    expect([200, 204]).toContain(removed.status);
  });
});

describe('数据库端点不注册（设计书 §6/P0-3）', () => {
  it('/api/db/tables → 404，oauth_tokens 无法经公网查询', async () => {
    const { cookie, csrfToken } = await login('10.5.0.1');
    const tables = await request(app).get('/api/db/tables').set('Cookie', cookie);
    expect(tables.status).toBe(404);

    // 带 CSRF 的合法请求同样 404：public 模式下 /api/db 整个未注册
    const query = await request(app)
      .post('/api/db/query')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ sql: 'SELECT * FROM oauth_tokens' });
    expect(query.status).toBe(404);
  });
});

describe('Provider Secret 脱敏与 Settings 白名单（设计书 §20/§22）', () => {
  const SECRET_VALUE = 'sk-public-test-secret-123456';

  it('保存密钥后 GET 不回显明文，仅 *_configured + providerConfigVersion', async () => {
    const { cookie, csrfToken } = await login('10.6.0.1');

    const put = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ deepseek_api_key: SECRET_VALUE });
    expect(put.status).toBe(200);
    expect(JSON.stringify(put.body)).not.toContain(SECRET_VALUE);

    const get = await request(app).get('/api/settings').set('Cookie', cookie);
    expect(get.status).toBe(200);
    const body = JSON.stringify(get.body);
    expect(body).not.toContain(SECRET_VALUE);
    expect(get.body.deepseek_api_key_configured).toBe(true);
    expect(typeof get.body.providerConfigVersion).toBe('number');
    expect(get.body.providerConfigVersion).toBeGreaterThanOrEqual(2);
  });

  it('未知设置项 → 400', async () => {
    const { cookie, csrfToken } = await login('10.6.0.2');
    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ evil_key: 'x' });
    expect(response.status).toBe(400);
  });

  it('server-only 内部地址（cliproxy_base_url）→ 400，且 GET 不返回', async () => {
    const { cookie, csrfToken } = await login('10.6.0.3');
    const put = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ cliproxy_base_url: 'http://127.0.0.9:9999/v1' });
    expect(put.status).toBe(400);

    const get = await request(app).get('/api/settings').set('Cookie', cookie);
    expect(get.body.cliproxy_base_url).toBeUndefined();
    expect(get.body.speech_base_url).toBeUndefined();
    expect(get.body.illustration_base_url).toBeUndefined();
  });
});

describe('LLM 凭据服务端解析（设计书 §21/§8 SSRF）', () => {
  it('chat 请求携带 apiKey → 400（不触达上游）', async () => {
    const { cookie, csrfToken } = await login('10.7.0.1');
    const response = await request(app)
      .post('/api/llm/chat')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ provider: 'deepseek', messages: [{ role: 'user', content: 'hi' }], options: { apiKey: 'sk-front' } });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('apiKey');
  });

  it('chat 请求携带 cliproxyBaseUrl → 400', async () => {
    const { cookie, csrfToken } = await login('10.7.0.2');
    const response = await request(app)
      .post('/api/llm/chat')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ provider: 'deepseek', messages: [], options: { cliproxyBaseUrl: 'http://127.0.0.1:8317/v1' } });
    expect(response.status).toBe(400);
  });

  it('models 请求携带 apiKey → 400', async () => {
    const { cookie, csrfToken } = await login('10.7.0.3');
    const response = await request(app)
      .post('/api/llm/models/deepseek')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ apiKey: 'sk-front' });
    expect(response.status).toBe(400);
  });
});

describe('内部服务地址不回显与资源限制（设计书 §25/§28/§45）', () => {
  it('speech/illustrations status 不包含 baseUrl', async () => {
    const { cookie } = await login('10.8.0.1');
    const speech = await request(app).get('/api/speech/status').set('Cookie', cookie);
    expect(speech.status).toBe(200);
    expect(speech.body.baseUrl).toBeUndefined();

    const illustration = await request(app).get('/api/illustrations/status').set('Cookie', cookie);
    expect(illustration.status).toBe(200);
    expect(illustration.body.baseUrl).toBeUndefined();
  });

  it('插画尺寸白名单外的请求 → 400（不触达 ComfyUI）', async () => {
    const { cookie, csrfToken } = await login('10.8.0.2');
    const response = await request(app)
      .post('/api/illustrations/generate')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .set('Origin', WEB_PUBLIC_URL)
      .send({ projectId: 'any', prompt: 'test', width: 4096, height: 4096 });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('尺寸');
  });
});

describe('安全响应头与缓存策略（设计书 §24/§38）', () => {
  it('公网响应带 CSP/nosniff/no-referrer/Cache-Control: no-store', async () => {
    const response = await request(app).get('/api/auth/session');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['strict-transport-security']).toBe('max-age=31536000');
    expect(response.headers['permissions-policy']).toContain('microphone=(self)');
  });

  it('业务 API 响应 Cache-Control: no-store', async () => {
    const { cookie } = await login('10.9.0.1');
    const response = await request(app).get('/api/projects').set('Cookie', cookie);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('公网启动 fail-fast 校验（设计书 §18）', () => {
  it('MCP_AUTH_MODE=none 在 public 校验中为致命错误', () => {
    const saved = process.env.MCP_AUTH_MODE;
    process.env.MCP_AUTH_MODE = 'none';
    const errors = validatePublicStartup();
    process.env.MCP_AUTH_MODE = saved;
    expect(errors.some(e => e.includes('MCP_AUTH_MODE'))).toBe(true);
  });

  it('HOST=0.0.0.0 为致命错误', () => {
    const saved = process.env.HOST;
    process.env.HOST = '0.0.0.0';
    const errors = validatePublicStartup();
    process.env.HOST = saved;
    expect(errors.some(e => e.includes('0.0.0.0'))).toBe(true);
  });

  it('配置齐全时校验通过（token 模式）', () => {
    const savedMode = process.env.MCP_AUTH_MODE;
    const savedUrl = process.env.MCP_PUBLIC_URL;
    const savedToken = process.env.MCP_STATIC_TOKEN;
    process.env.MCP_AUTH_MODE = 'token';
    process.env.MCP_PUBLIC_URL = 'https://mcp.example.com';
    process.env.MCP_STATIC_TOKEN = 'some-token';
    const errors = validatePublicStartup();
    process.env.MCP_AUTH_MODE = savedMode;
    process.env.MCP_PUBLIC_URL = savedUrl;
    process.env.MCP_STATIC_TOKEN = savedToken;
    expect(errors).toEqual([]);
  });
});
