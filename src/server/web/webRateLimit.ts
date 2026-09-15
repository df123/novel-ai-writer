// Web 端限流（设计书 §30）：登录失败限制 + 常规 API + 高成本接口限制
// 内存滑窗实现（单实例部署前提，与 MCP 限流同模型）；仅在 public 模式挂载
import type { Request, Response, NextFunction } from 'express';
import type { WebSessionInfo } from './webSession';

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

/** Map 容量保护：超过后强制清理（评审 P1：防不同 IP/会话扫描造成永久增长） */
const MAX_BUCKETS = 10_000;
/** 每多少次计数操作触发一次全量过期清扫（小值兼顾可测试性与开销） */
const SWEEP_EVERY = 64;
let operationsSinceSweep = 0;

/** 清理全部已过期 bucket；返回剩余数量 */
function sweepExpired(): number {
  const nowMs = Date.now();
  for (const [key, bucket] of buckets) {
    const windowMs = SPECS[key.split(':')[0] as keyof typeof SPECS]?.windowMs;
    if (windowMs === undefined || nowMs - bucket.windowStart >= windowMs) {
      buckets.delete(key);
    }
  }
  return buckets.size;
}

function take(name: string, key: string): boolean {
  const spec = SPECS[name];
  const nowMs = Date.now();
  const mapKey = `${name}:${key}`;

  maybeSweep();

  const bucket = buckets.get(mapKey);
  if (!bucket || nowMs - bucket.windowStart >= spec.windowMs) {
    buckets.set(mapKey, { windowStart: nowMs, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= spec.max;
}

/**
 * 所有 bucket 写入共用的维护入口（评审 P1 收口）：
 * 定期清过期 bucket + 容量保护，防止只写不扫的路径（如失败计数）造成 Map 永久增长
 */
function maybeSweep(): void {
  operationsSinceSweep += 1;
  if (operationsSinceSweep < SWEEP_EVERY && buckets.size <= MAX_BUCKETS) return;
  operationsSinceSweep = 0;
  if (sweepExpired() > MAX_BUCKETS) {
    const byAge = [...buckets.entries()].sort((a, b) => a[1].windowStart - b[1].windowStart);
    for (const [staleKey] of byAge.slice(0, byAge.length - MAX_BUCKETS)) {
      buckets.delete(staleKey);
    }
  }
}

/** 计入一次失败计数（窗口内累加，窗口过期重开），走统一维护入口 */
function recordFailure(name: 'loginFail' | 'oauthAuthorizeFail', key: string): void {
  const spec = SPECS[name];
  const mapKey = `${name}:fails:${key}`;
  const nowMs = Date.now();

  maybeSweep();

  const bucket = buckets.get(mapKey);
  if (!bucket || nowMs - bucket.windowStart >= spec.windowMs) {
    buckets.set(mapKey, { windowStart: nowMs, count: 1 });
    return;
  }
  bucket.count += 1;
}

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

/** 登录前置检查：同 IP 15 分钟内失败次数是否已超限 */
export function isLoginBlocked(ip: string): boolean {
  const spec = SPECS.loginFail;
  const bucket = buckets.get(`loginFail:fails:${ip}`);
  return !!bucket && bucket.count >= spec.max && Date.now() - bucket.windowStart < spec.windowMs;
}

/** 记录一次登录失败 */
export function recordLoginFailure(ip: string): void {
  recordFailure('loginFail', ip);
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
  recordFailure('oauthAuthorizeFail', ip);
}

/** 测试辅助：清空全部限流桶 */
export function resetRateLimiter(): void {
  buckets.clear();
}

/** 测试辅助：当前 bucket 总数（验证过期清扫） */
export function getBucketCount(): number {
  return buckets.size;
}
