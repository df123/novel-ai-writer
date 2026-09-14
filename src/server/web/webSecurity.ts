// Web 安全边界中间件（设计书 §15/§16/§24/§38）：
// 仅作用于 /api/*，绝不套到 /mcp、/oauth、/.well-known、/mcp/download（MCP 认证模型不变）
import type { Request, Response, NextFunction } from 'express';
import { getWebPublicUrl, isPublicMode } from '../config';
import { resolveWebSession, type WebSessionInfo } from './webSession';

/** 携带 Web 会话信息的请求类型（webApiGuard 解析后挂载） */
export type GuardedRequest = Request & { webSession?: WebSessionInfo };

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 从基准 URL 提取 Origin（scheme://host[:port]） */
function expectedOrigin(): string {
  try {
    return new URL(getWebPublicUrl()).origin;
  } catch {
    return '';
  }
}

/** 校验 Origin 头与站点一致（不含头时放行，CSRF token 仍是主防线） */
function originAllowed(req: Request): boolean {
  const expected = expectedOrigin();
  if (!expected) return true;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  return origin === expected;
}

/**
 * /api/* 统一门卫（仅 public 模式生效）：
 * 1. 解析会话 → 未登录 401
 * 2. 非安全方法 → Origin 校验 + X-CSRF-Token 校验，失败 403
 * 豁免：POST /api/auth/login（登录引导，仅 Origin 校验）、GET /api/auth/session（探测）
 */
export function webApiGuard(req: Request, res: Response, next: NextFunction): void {
  if (!isPublicMode()) {
    next();
    return;
  }

  const isLogin = req.path === '/auth/login' && req.method === 'POST';
  const isSessionProbe = req.path === '/auth/session' && req.method === 'GET';
  if (!isLogin && !isSessionProbe) {
    const session = resolveWebSession(req);
    if (!session) {
      res.status(401).json({ error: '未登录或会话已过期' });
      return;
    }
    (req as GuardedRequest).webSession = session;
  }

  if (UNSAFE_METHODS.has(req.method)) {
    if (!originAllowed(req)) {
      res.status(403).json({ error: 'Origin 校验失败' });
      return;
    }
    if (isLogin) {
      next();
      return;
    }
    const token = req.headers['x-csrf-token'];
    const session = (req as GuardedRequest).webSession;
    if (typeof token !== 'string' || !session || token !== session.csrfToken) {
      res.status(403).json({ error: 'CSRF 校验失败' });
      return;
    }
  }

  next();
}

/** 登录请求的 Origin 校验（public 模式；local 模式直通） */
export function loginOriginGuard(req: Request, res: Response, next: NextFunction): void {
  if (isPublicMode() && !originAllowed(req)) {
    res.status(403).json({ error: 'Origin 校验失败' });
    return;
  }
  next();
}

/** 安全响应头（设计书 §24，public 模式全站生效；Apache 侧再叠加 HSTS 亦可） */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'"
    ].join('; ')
  );
  // 应用确实使用麦克风（语音输入），其余权限一律关闭
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  if (getWebPublicUrl().startsWith('https://')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
}

/** 私人 API 响应禁止缓存（设计书 §38，public 模式） */
export function apiNoStore(_req: Request, res: Response, next: NextFunction): void {
  if (isPublicMode()) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}
