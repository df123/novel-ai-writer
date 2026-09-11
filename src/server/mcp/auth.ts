// MCP 认证：与业务逻辑隔离
// 三种模式（环境变量 MCP_AUTH_MODE）：
//   none  - 开发用，直接放行；生产环境启动时打印显著警告
//   token - 静态 Bearer Token（MCP_STATIC_TOKEN），适合 ChatGPT 自定义连接器粘贴令牌的场景
//   oauth - OAuth 2.1 授权服务器（PKCE + 动态客户端注册），符合 MCP Authorization 规范
import express, { Router, Request, Response, NextFunction } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** 认证模式 */
export type McpAuthMode = 'none' | 'token' | 'oauth';

export function getAuthMode(): McpAuthMode {
  const mode = (process.env.MCP_AUTH_MODE || 'none').toLowerCase();
  return mode === 'token' || mode === 'oauth' ? mode : 'none';
}

/** 服务器对外基准 URL（OAuth issuer / 元数据端点用），如 https://mcp.example.com */
export function getPublicBaseUrl(): string {
  return (process.env.MCP_PUBLIC_URL || 'http://localhost:3002').replace(/\/+$/, '');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

let productionWarningShown = false;

/** /mcp 认证中间件 */
export function mcpAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const mode = getAuthMode();

  if (mode === 'none') {
    if (process.env.NODE_ENV === 'production' && !productionWarningShown) {
      productionWarningShown = true;
      console.warn('==================================================================');
      console.warn('⚠️  MCP_AUTH_MODE=none —— /mcp 正在无认证运行！');
      console.warn('⚠️  任何能访问该端口的人都可以读取/修改你的全部小说数据。');
      console.warn('⚠️  公网部署必须设置 MCP_AUTH_MODE=token 或 oauth。');
      console.warn('==================================================================');
    }
    next();
    return;
  }

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).header('WWW-Authenticate', 'Bearer').json({ error: 'unauthorized', error_description: 'Missing bearer token' });
    return;
  }
  const token = match[1].trim();

  if (mode === 'token') {
    const expected = process.env.MCP_STATIC_TOKEN || '';
    if (!expected) {
      console.error('[mcp-auth] MCP_AUTH_MODE=token 但未配置 MCP_STATIC_TOKEN');
      res.status(500).json({ error: 'server_error', error_description: 'Auth misconfigured' });
      return;
    }
    if (safeEqual(token, expected)) {
      next();
      return;
    }
    res.status(401).header('WWW-Authenticate', 'Bearer').json({ error: 'unauthorized' });
    return;
  }

  // oauth 模式：校验内存令牌库中的访问令牌
  if (isValidAccessToken(token)) {
    next();
    return;
  }
  res.status(401).header('WWW-Authenticate', 'Bearer').json({ error: 'unauthorized' });
}

// ===== OAuth 2.1 授权服务器（单用户，内存存储） =====

interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  clientName: string;
  createdAt: number;
}

interface AuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

interface TokenRecord {
  token: string;
  kind: 'access' | 'refresh';
  clientId: string;
  expiresAt: number;
}

const ACCESS_TTL_MS = 12 * 60 * 60 * 1000;   // 12 小时
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const CODE_TTL_MS = 10 * 60 * 1000;          // 10 分钟

const clients = new Map<string, OAuthClient>();
const codes = new Map<string, AuthCode>();
const tokens = new Map<string, TokenRecord>();

function isValidAccessToken(token: string): boolean {
  const record = tokens.get(token);
  if (!record || record.kind !== 'access') {
    return false;
  }
  if (record.expiresAt < Date.now()) {
    tokens.delete(token);
    return false;
  }
  return true;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sha256(input: string): string {
  return base64url(createHash('sha256').update(input).digest());
}

/** OAuth 授权页面 + 端点（挂载在 /oauth，与 /mcp 同域） */
export const oauthRouter: Router = express.Router();

oauthRouter.use(express.urlencoded({ extended: false }));

/** 简单授权页：用户输入访问口令批准 ChatGPT 的授权请求 */
oauthRouter.get('/authorize', (req: Request, res: Response) => {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.query as Record<string, string>;
  if (!client_id || !clients.has(client_id)) {
    res.status(400).send('invalid client_id');
    return;
  }
  if (!redirect_uri || !code_challenge) {
    res.status(400).send('missing redirect_uri or code_challenge (PKCE required)');
    return;
  }
  if (code_challenge_method && code_challenge_method !== 'S256') {
    res.status(400).send('only S256 code_challenge_method is supported');
    return;
  }
  const client = clients.get(client_id)!;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Novel Writer MCP 授权</title>
<style>body{font-family:sans-serif;max-width:420px;margin:60px auto;padding:0 16px}input{width:100%;padding:8px;margin:8px 0;box-sizing:border-box}button{padding:8px 24px}</style>
</head><body>
<h2>授权请求</h2>
<p>应用 <b>${escapeHtml(client.clientName || client_id)}</b> 请求访问你的小说数据。</p>
<form method="POST" action="${getPublicBaseUrl()}/oauth/authorize">
  <input type="hidden" name="client_id" value="${escapeHtml(client_id)}">
  <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}">
  <input type="hidden" name="state" value="${escapeHtml(state || '')}">
  <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge)}">
  <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || 'S256')}">
  <label>访问口令：<input type="password" name="password" autofocus></label>
  <button type="submit">批准授权</button>
</form>
</body></html>`);
});

oauthRouter.post('/authorize', (req: Request, res: Response) => {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method, password } = req.body as Record<string, string>;
  const expectedPassword = process.env.MCP_OAUTH_PASSWORD || '';
  if (!expectedPassword) {
    res.status(500).send('MCP_OAUTH_PASSWORD not configured on server');
    return;
  }
  if (!client_id || !clients.has(client_id)) {
    res.status(400).send('invalid client_id');
    return;
  }
  if (!password || !safeEqual(password, expectedPassword)) {
    res.status(401).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send('<p>口令错误。<a href="javascript:history.back()">返回重试</a></p>');
    return;
  }
  const code = base64url(randomBytes(32));
  codes.set(code, {
    code,
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    expiresAt: Date.now() + CODE_TTL_MS
  });
  void code_challenge_method;
  const redirect = new URL(redirect_uri);
  redirect.searchParams.set('code', code);
  if (state) {
    redirect.searchParams.set('state', state);
  }
  res.redirect(302, redirect.toString());
});

/** OAuth 令牌端点（authorization_code + refresh_token，PKCE 校验） */
oauthRouter.post('/token', (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const grantType = body.grant_type;

  if (grantType === 'authorization_code') {
    const { code, redirect_uri, client_id, code_verifier } = body;
    const record = code ? codes.get(code) : undefined;
    if (!record || record.expiresAt < Date.now()) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'code expired or invalid' });
      return;
    }
    if (!client_id || client_id !== record.clientId || redirect_uri !== record.redirectUri) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
    if (!code_verifier || sha256(code_verifier) !== record.codeChallenge) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      return;
    }
    codes.delete(code);
    res.json(issueTokens(client_id));
    return;
  }

  if (grantType === 'refresh_token') {
    const { refresh_token, client_id } = body;
    const record = refresh_token ? tokens.get(refresh_token) : undefined;
    if (!record || record.kind !== 'refresh' || record.expiresAt < Date.now() || record.clientId !== client_id) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
    tokens.delete(refresh_token);
    res.json(issueTokens(client_id));
    return;
  }

  res.status(400).json({ error: 'unsupported_grant_type' });
});

function issueTokens(clientId: string): { access_token: string; token_type: string; expires_in: number; refresh_token: string } {
  const access = base64url(randomBytes(32));
  const refresh = base64url(randomBytes(32));
  const nowMs = Date.now();
  tokens.set(access, { token: access, kind: 'access', clientId, expiresAt: nowMs + ACCESS_TTL_MS });
  tokens.set(refresh, { token: refresh, kind: 'refresh', clientId, expiresAt: nowMs + REFRESH_TTL_MS });
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refresh
  };
}

/** 动态客户端注册（RFC 7591 / MCP 规范要求） */
oauthRouter.post('/register', express.json(), (req: Request, res: Response) => {
  const body = req.body as { client_name?: string; redirect_uris?: string[] };
  if (!body.redirect_uris || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    res.status(400).json({ error: 'invalid_redirect_uri' });
    return;
  }
  const clientId = base64url(randomBytes(16));
  const clientSecret = base64url(randomBytes(32));
  clients.set(clientId, {
    clientId,
    clientSecret,
    redirectUris: body.redirect_uris,
    clientName: body.client_name || 'MCP Client',
    createdAt: Date.now()
  });
  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name || 'MCP Client',
    redirect_uris: body.redirect_uris
  });
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
