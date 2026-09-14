// Web 端限流（设计书 §30）：登录失败限制 + 常规 API + 高成本接口限制
// 内存滑窗实现（单实例部署前提，与 MCP 限流同模型）；仅在 public 模式挂载
import type { Request, Response, NextFunction } from 'express';
import type { WebSessionInfo } from './webSession';

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

interface LimiterSpec {
  /** 窗口长度（毫秒） */
  windowMs: number;
  /** 窗口内最大次数 */
  max: number;
}

const SPECS: Record<string, LimiterSpec> = {
  loginFail: { windowMs: 15 * 60_000, max: 5 },
  api: { windowMs: 5 * 60_000, max: 300 },
  llm: { windowMs:  5 * 60_000, max: 20 },
  research: { windowMs: 5 * 60_000, max: 30 },
  speech: { windowMs: 5 * 60_000, max: 10 },
  illustration: { windowMs: 10 * 60_000, max: 5 },
  export: { windowMs: 10 * 60_000, max: 10 },
  oauthAuthorizeFail: { windowMs: 15 * 60_000, max: 10 },
  oauthToken: { windowMs: 60_000, max: 120 },
  oauthRegister: { windowMs: 60_000, max: 30 }
};

function take(name: string, key: string): boolean {
  const spec = SPECS[name];
  const nowMs = Date.now();
  const mapKey = `${name}:${key}`;
  const bucket = buckets.get(mapKey);
  if (!bucket || nowMs - bucket.windowStart >= spec.windowMs) {
    buckets.set(mapKey, { windowStart: nowMs, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= spec.max;
}

/** 登录前置检查：同 IP 15 分钟内失败次数是否已超限 */
export function isLoginBlocked(ip: string): boolean {
  const spec = SPECS.loginFail;
  const bucket = buckets.get(`loginFail:fails:${ip}`);
  return !!bucket && bucket.count >= spec.max && Date.now() - bucket.windowStart < spec.windowMs;
}

/** 记录一次登录失败 */
export function recordLoginFailure(ip: string): void {
  const spec = SPECS.loginFail;
  const key = `loginFail:fails:${ip}`;
  const bucket = buckets.get(key);
  if (!bucket || Date.now() - bucket.windowStart >= spec.windowMs) {
    buckets.set(key, { windowStart: Date.now(), count: 1 });
    return;
  }
  bucket.count += 1;
}

/** 通用 API 限流中间件工厂：按会话（回退 IP）计数 */
export function rateLimitMiddleware(name: keyof typeof SPECS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as Request & { webSession?: WebSessionInfo }).webSession;
    const key = session?.id ?? req.ip ?? 'unknown';
    if (take(name, key)) {
      next();
      return;
    }
    const spec = SPECS[name];
    res.status(429).header('Retry-After', String(Math.ceil(spec.windowMs / 1000))).json({
      error: '请求过于频繁，请稍后再试'
    });
  };
}

/** OAuth 端点限流（设计书 §36 P1 hardening）：不改变协议，仅按 IP 计数 */
export function oauthRateLimit(name: 'oauthAuthorizeFail' | 'oauthToken' | 'oauthRegister', ip: string): boolean {
  if (name === 'oauthAuthorizeFail') {
    // authorize 失败专门计数（take 用于窗口维护，超限即拒绝）
    const spec = SPECS.oauthAuthorizeFail;
    const key = `oauthAuthorizeFail:fails:${ip}`;
    const bucket = buckets.get(key);
    if (bucket && Date.now() - bucket.windowStart < spec.windowMs && bucket.count >= spec.max) {
      return false;
    }
    return true;
  }
  return take(name, ip);
}

/** 记录一次 authorize 密码错误 */
export function recordOauthAuthorizeFailure(ip: string): void {
  const spec = SPECS.oauthAuthorizeFail;
  const key = `oauthAuthorizeFail:fails:${ip}`;
  const bucket = buckets.get(key);
  if (!bucket || Date.now() - bucket.windowStart >= spec.windowMs) {
    buckets.set(key, { windowStart: Date.now(), count: 1 });
    return;
  }
  bucket.count += 1;
}

/** 测试辅助：清空全部限流桶 */
export function resetRateLimiter(): void {
  buckets.clear();
}
