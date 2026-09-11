// OAuth 2.1 授权服务器自动化测试(不记录任何真实 token/secret 到断言输出)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHash } from 'crypto';
import { initDB } from '../../src/server/db';
import { createApp } from '../../src/server/app';
import { _testSimulateRestart } from '../../src/server/mcp/auth';

let app: ReturnType<typeof createApp>;
const TEST_PASSWORD = 'oauth-test-password';
const REDIRECT_A = 'https://client-a.example.com/callback';
const REDIRECT_B = 'https://client-b.example.com/callback';

/** S256 PKCE challenge */
function challenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** 走完整授权码流程拿 token(默认 public client) */
async function authorizationCodeFlow(options: {
  clientId: string;
  redirectUri: string;
  verifier: string;
  password?: string;
  useRedirectUriAtToken?: string;
}): Promise<{ status: number; body: Record<string, string> }> {
  const ch = challenge(options.verifier);
  const authorize = await request(app)
    .post('/oauth/authorize')
    .type('form')
    .send({
      client_id: options.clientId,
      redirect_uri: options.redirectUri,
      state: 'st',
      code_challenge: ch,
      code_challenge_method: 'S256',
      password: options.password ?? TEST_PASSWORD
    });
  if (authorize.status !== 302) {
    return { status: authorize.status, body: {} };
  }
  const location = authorize.headers.location as string;
  const code = new URL(location).searchParams.get('code') || '';
  return request(app)
    .post('/oauth/token')
    .type('form')
    .send({
      grant_type: 'authorization_code',
      code,
      redirect_uri: options.useRedirectUriAtToken ?? options.redirectUri,
      client_id: options.clientId,
      code_verifier: options.verifier
    });
}

/** DCR 注册客户端 */
async function registerClient(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, string> }> {
  return request(app).post('/oauth/register').send(body);
}

/** 用 access token 调 /mcp */
async function callMcpInitialize(accessToken: string): Promise<number> {
  const res = await request(app)
    .post('/mcp')
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  return res.status;
}

beforeAll(async () => {
  await initDB();
  process.env.MCP_AUTH_MODE = 'oauth';
  process.env.MCP_OAUTH_PASSWORD = TEST_PASSWORD;
  process.env.MCP_PUBLIC_URL = 'https://auth-test.example.com';
  app = createApp();
});

afterAll(() => {
  process.env.MCP_AUTH_MODE = 'none';
  delete process.env.MCP_OAUTH_PASSWORD;
  process.env.MCP_PUBLIC_URL = 'http://localhost:3002';
});

describe('well-known 元数据按模式发布', () => {
  it('oauth 模式发布两份元数据且与实现一致', async () => {
    const pr = await request(app).get('/.well-known/oauth-protected-resource');
    expect(pr.status).toBe(200);
    expect(pr.body.resource).toBe('https://auth-test.example.com/mcp');
    expect(pr.body.authorization_servers).toEqual(['https://auth-test.example.com']);

    const as = await request(app).get('/.well-known/oauth-authorization-server');
    expect(as.status).toBe(200);
    expect(as.body.issuer).toBe('https://auth-test.example.com');
    expect(as.body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    expect(as.body.code_challenge_methods_supported).toEqual(['S256']);
    expect(as.body.token_endpoint_auth_methods_supported).toEqual(['none', 'client_secret_post', 'client_secret_basic']);
  });

  it('token 模式不发布 OAuth 元数据', async () => {
    process.env.MCP_AUTH_MODE = 'token';
    process.env.MCP_STATIC_TOKEN = 'x';
    expect((await request(app).get('/.well-known/oauth-protected-resource')).status).toBe(404);
    expect((await request(app).get('/.well-known/oauth-authorization-server')).status).toBe(404);
    process.env.MCP_AUTH_MODE = 'oauth';
    delete process.env.MCP_STATIC_TOKEN;
  });

  it('none 模式不发布 OAuth 元数据', async () => {
    process.env.MCP_AUTH_MODE = 'none';
    expect((await request(app).get('/.well-known/oauth-protected-resource')).status).toBe(404);
    process.env.MCP_AUTH_MODE = 'oauth';
  });
});

describe('P0-2: redirect_uri 严格校验', () => {
  it('注册 redirect A,authorize 用 A 成功,用 B 被拒', async () => {
    const reg = await registerClient({ client_name: 'redirect-test', redirect_uris: [REDIRECT_A] });
    expect(reg.status).toBe(201);
    const clientId = reg.body.client_id;

    const okPage = await request(app).get('/oauth/authorize').query({
      client_id: clientId, redirect_uri: REDIRECT_A, state: 's', code_challenge: challenge('v'.repeat(43)), code_challenge_method: 'S256'
    });
    expect(okPage.status).toBe(200);

    const bad = await request(app).get('/oauth/authorize').query({
      client_id: clientId, redirect_uri: REDIRECT_B, state: 's', code_challenge: challenge('v'.repeat(43)), code_challenge_method: 'S256'
    });
    expect(bad.status).toBe(400);
  });

  it('authorize POST 阶段 redirect B 同样被拒', async () => {
    const reg = await registerClient({ client_name: 'redirect-post', redirect_uris: [REDIRECT_A] });
    const res = await request(app).post('/oauth/authorize').type('form').send({
      client_id: reg.body.client_id, redirect_uri: REDIRECT_B, code_challenge: challenge('v'.repeat(43)), code_challenge_method: 'S256', password: TEST_PASSWORD
    });
    expect(res.status).toBe(400);
  });

  it('token 端点使用不同 redirect URI 必须失败', async () => {
    const reg = await registerClient({ client_name: 'redirect-token', redirect_uris: [REDIRECT_A] });
    const res = await authorizationCodeFlow({
      clientId: reg.body.client_id,
      redirectUri: REDIRECT_A,
      verifier: 'a'.repeat(43),
      useRedirectUriAtToken: REDIRECT_B
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });
});

describe('P0-1: client_secret 真校验', () => {
  it('public client(none)+ PKCE 成功换取令牌并可调 /mcp', async () => {
    const reg = await registerClient({ client_name: 'public-client', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'none' });
    const tokenRes = await authorizationCodeFlow({ clientId: reg.body.client_id, redirectUri: REDIRECT_A, verifier: 'p'.repeat(64) });
    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.token_type).toBe('Bearer');
    expect(await callMcpInitialize(tokenRes.body.access_token)).toBe(200);
  });

  it('正确的 client_secret_post 成功', async () => {
    const reg = await registerClient({ client_name: 'confidential-post', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_post' });
    const clientId = reg.body.client_id;
    const clientSecret = reg.body.client_secret;

    // 先拿授权码
    const auth = await request(app).post('/oauth/authorize').type('form').send({
      client_id: clientId, redirect_uri: REDIRECT_A, code_challenge: challenge('c'.repeat(43)), code_challenge_method: 'S256', password: TEST_PASSWORD
    });
    const code = new URL(auth.headers.location as string).searchParams.get('code') || '';
    const tokenRes = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT_A, client_id: clientId, client_secret: clientSecret, code_verifier: 'c'.repeat(43)
    });
    expect(tokenRes.status).toBe(200);
  });

  it('错误的 client_secret_post 失败(401 invalid_client)', async () => {
    const reg = await registerClient({ client_name: 'confidential-post-bad', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_post' });
    const auth = await request(app).post('/oauth/authorize').type('form').send({
      client_id: reg.body.client_id, redirect_uri: REDIRECT_A, code_challenge: challenge('d'.repeat(43)), code_challenge_method: 'S256', password: TEST_PASSWORD
    });
    const code = new URL(auth.headers.location as string).searchParams.get('code') || '';
    const tokenRes = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT_A, client_id: reg.body.client_id, client_secret: 'wrong-secret', code_verifier: 'd'.repeat(43)
    });
    expect(tokenRes.status).toBe(401);
    expect(tokenRes.body.error).toBe('invalid_client');
  });

  it('正确的 client_secret_basic 成功', async () => {
    const reg = await registerClient({ client_name: 'confidential-basic', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_basic' });
    const auth = await request(app).post('/oauth/authorize').type('form').send({
      client_id: reg.body.client_id, redirect_uri: REDIRECT_A, code_challenge: challenge('e'.repeat(43)), code_challenge_method: 'S256', password: TEST_PASSWORD
    });
    const code = new URL(auth.headers.location as string).searchParams.get('code') || '';
    const basic = Buffer.from(`${reg.body.client_id}:${reg.body.client_secret}`).toString('base64');
    const tokenRes = await request(app).post('/oauth/token').set('Authorization', `Basic ${basic}`).type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT_A, code_verifier: 'e'.repeat(43)
    });
    expect(tokenRes.status).toBe(200);
  });

  it('错误的 client_secret_basic 失败', async () => {
    const reg = await registerClient({ client_name: 'confidential-basic-bad', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_basic' });
    const auth = await request(app).post('/oauth/authorize').type('form').send({
      client_id: reg.body.client_id, redirect_uri: REDIRECT_A, code_challenge: challenge('f'.repeat(43)), code_challenge_method: 'S256', password: TEST_PASSWORD
    });
    const code = new URL(auth.headers.location as string).searchParams.get('code') || '';
    const basic = Buffer.from(`${reg.body.client_id}:wrong-secret`).toString('base64');
    const tokenRes = await request(app).post('/oauth/token').set('Authorization', `Basic ${basic}`).type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT_A, code_verifier: 'f'.repeat(43)
    });
    expect(tokenRes.status).toBe(401);
  });

  it('confidential 客户端不带 secret 时失败', async () => {
    const reg = await registerClient({ client_name: 'confidential-nosecret', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_post' });
    const tokenRes = await authorizationCodeFlow({ clientId: reg.body.client_id, redirectUri: REDIRECT_A, verifier: 'g'.repeat(43) });
    expect(tokenRes.status).toBe(401);
    expect(tokenRes.body.error).toBe('invalid_client');
  });
});

describe('授权码与令牌生命周期', () => {
  it('PKCE 校验失败:verifier 不匹配', async () => {
    const reg = await registerClient({ client_name: 'pkce-bad', redirect_uris: [REDIRECT_A] });
    const res = await authorizationCodeFlow({ clientId: reg.body.client_id, redirectUri: REDIRECT_A, verifier: 'h'.repeat(43) });
    // 用正确流程但换 verifier:直接构造
    const auth = await request(app).post('/oauth/authorize').type('form').send({
      client_id: reg.body.client_id, redirect_uri: REDIRECT_A, code_challenge: challenge('correct-verifier-0123456789012345678901234567'), code_challenge_method: 'S256', password: TEST_PASSWORD
    });
    const code = new URL(auth.headers.location as string).searchParams.get('code') || '';
    const tokenRes = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT_A, client_id: reg.body.client_id, code_verifier: 'wrong-verifier-0123456789012345678901234567'
    });
    expect(tokenRes.status).toBe(400);
    expect(tokenRes.body.error).toBe('invalid_grant');
    void res;
  });

  it('错误口令无法获得授权码', async () => {
    const reg = await registerClient({ client_name: 'bad-password', redirect_uris: [REDIRECT_A] });
    const res = await request(app).post('/oauth/authorize').type('form').send({
      client_id: reg.body.client_id, redirect_uri: REDIRECT_A, code_challenge: challenge('i'.repeat(43)), code_challenge_method: 'S256', password: 'wrong-password'
    });
    expect(res.status).toBe(401);
  });

  it('授权码只能使用一次(重放失败)', async () => {
    const reg = await registerClient({ client_name: 'code-replay', redirect_uris: [REDIRECT_A] });
    const verifier = 'j'.repeat(43);
    const auth = await request(app).post('/oauth/authorize').type('form').send({
      client_id: reg.body.client_id, redirect_uri: REDIRECT_A, code_challenge: challenge(verifier), code_challenge_method: 'S256', password: TEST_PASSWORD
    });
    const code = new URL(auth.headers.location as string).searchParams.get('code') || '';
    const first = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT_A, client_id: reg.body.client_id, code_verifier: verifier
    });
    expect(first.status).toBe(200);
    const replay = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT_A, client_id: reg.body.client_id, code_verifier: verifier
    });
    expect(replay.status).toBe(400);
  });

  it('refresh_token 正常轮换,旧 refresh 作废,无效 refresh 被拒', async () => {
    const reg = await registerClient({ client_name: 'refresh-flow', redirect_uris: [REDIRECT_A] });
    const tokenRes = await authorizationCodeFlow({ clientId: reg.body.client_id, redirectUri: REDIRECT_A, verifier: 'k'.repeat(43) });
    const refresh = tokenRes.body.refresh_token;

    const refreshed = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token', refresh_token: refresh, client_id: reg.body.client_id
    });
    expect(refreshed.status).toBe(200);
    expect(await callMcpInitialize(refreshed.body.access_token)).toBe(200);

    // 旧 refresh 已轮换作废
    const replay = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token', refresh_token: refresh, client_id: reg.body.client_id
    });
    expect(replay.status).toBe(400);

    const invalid = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token', refresh_token: 'not-a-token', client_id: reg.body.client_id
    });
    expect(invalid.status).toBe(400);
  });

  it('RFC 9207:授权重定向包含 iss 参数', async () => {
    const reg = await registerClient({ client_name: 'iss-check', redirect_uris: [REDIRECT_A] });
    const auth = await request(app).post('/oauth/authorize').type('form').send({
      client_id: reg.body.client_id, redirect_uri: REDIRECT_A, state: 'xyz', code_challenge: challenge('l'.repeat(43)), code_challenge_method: 'S256', password: TEST_PASSWORD
    });
    expect(auth.status).toBe(302);
    const url = new URL(auth.headers.location as string);
    expect(url.searchParams.get('iss')).toBe('https://auth-test.example.com');
    expect(url.searchParams.get('state')).toBe('xyz');
    expect(url.searchParams.get('code')).toBeTruthy();
  });
});

describe('OAuth 持久化(真实落盘重载)', () => {
  it('重新 initDB() 从磁盘文件重建后:客户端注册、access、refresh 均可用', async () => {
    const reg = await registerClient({ client_name: 'persist-client', redirect_uris: [REDIRECT_A] });
    const clientId = reg.body.client_id;
    const tokenRes = await authorizationCodeFlow({ clientId, redirectUri: REDIRECT_A, verifier: 'z'.repeat(43) });
    expect(tokenRes.status).toBe(200);
    const accessToken = tokenRes.body.access_token;
    const refreshToken = tokenRes.body.refresh_token;

    // 真实重启模拟:丢弃当前 sql.js Database,重新 initDB() 从磁盘 database.db 加载
    await initDB();
    _testSimulateRestart();

    // 重启后旧 access token 仍能调 /mcp
    expect(await callMcpInitialize(accessToken)).toBe(200);

    // 重启后旧 refresh token 仍能轮换,且新令牌继续可用
    const refreshed = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId
    });
    expect(refreshed.status).toBe(200);
    expect(await callMcpInitialize(refreshed.body.access_token)).toBe(200);
  });

  it('落盘验证:oauth_clients/oauth_tokens 行真实存在于磁盘文件', async () => {
    const reg = await registerClient({ client_name: 'disk-check', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_post' });
    await authorizationCodeFlow({ clientId: reg.body.client_id, redirectUri: REDIRECT_A, verifier: 'y'.repeat(43) });

    // 重新 initDB 从磁盘读,直接查表计数(不经过内存缓存)
    await initDB();
    const { query } = await import('../../src/server/db');
    const clientRows = query<{ count: number }>('SELECT COUNT(*) as count FROM oauth_clients');
    const tokenRows = query<{ count: number }>('SELECT COUNT(*) as count FROM oauth_tokens');
    expect(clientRows[0].count).toBeGreaterThanOrEqual(2); // 本文件先前用例注册的 + 本次
    expect(tokenRows[0].count).toBeGreaterThanOrEqual(2);  // access + refresh 至少一对
  });
});

describe('authMethod 严格匹配(注册方法必须等于使用方法)', () => {
  it('注册 basic,用 post 发 secret 必须失败', async () => {
    const reg = await registerClient({ client_name: 'cross-bp', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_basic' });
    const res = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token', refresh_token: 'whatever', client_id: reg.body.client_id, client_secret: reg.body.client_secret
    });
    expect(res.status).toBe(401);
  });

  it('注册 post,用 basic 发凭据必须失败', async () => {
    const reg = await registerClient({ client_name: 'cross-pb', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_post' });
    const basic = Buffer.from(`${reg.body.client_id}:${reg.body.client_secret}`).toString('base64');
    const res = await request(app).post('/oauth/token').set('Authorization', `Basic ${basic}`).type('form').send({
      grant_type: 'refresh_token', refresh_token: 'whatever'
    });
    expect(res.status).toBe(401);
  });

  it('注册 none 的 public 客户端携带 secret 不能升级为 confidential', async () => {
    const reg = await registerClient({ client_name: 'upgrade-attempt', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'none' });
    const fakeSecret = 'should-not-matter';
    const res = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token', refresh_token: 'whatever', client_id: reg.body.client_id, client_secret: fakeSecret
    });
    expect(res.status).toBe(401);
  });

  it('public(none)注册响应不包含 client_secret 字段', async () => {
    const reg = await registerClient({ client_name: 'no-secret-response', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'none' });
    expect(reg.status).toBe(201);
    expect(reg.body).not.toHaveProperty('client_secret');
  });
});

describe('/mcp 认证边界', () => {
  it('oauth 模式下无令牌 401 且 WWW-Authenticate 带 resource_metadata', async () => {
    const res = await request(app).post('/mcp').set('Accept', 'application/json, text/event-stream').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(401);
    expect(String(res.headers['www-authenticate'])).toContain('resource_metadata=');
  });

  it('伪造 access token 401', async () => {
    const res = await request(app).post('/mcp').set('Authorization', 'Bearer forged-token').set('Accept', 'application/json, text/event-stream').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(401);
  });

  it('DCR 拒绝不支持的 token_endpoint_auth_method', async () => {
    const res = await registerClient({ client_name: 'bad-method', redirect_uris: [REDIRECT_A], token_endpoint_auth_method: 'client_secret_jwt' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_client_metadata');
  });
});
