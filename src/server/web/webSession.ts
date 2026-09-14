// Web 会话管理（设计书 §13）：32 字节随机不透明令牌 + HttpOnly Secure SameSite=Strict Cookie
// 数据库只存 SHA-256(token_hash)，数据库泄漏也无法直接冒充会话
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { query, run } from '../db';
import { withWriteTransaction } from '../db/transaction';
import { generateId, now } from '../utils/helpers';
import { getWebSessionTtlSeconds, WEB_MAX_ACTIVE_SESSIONS } from '../config';

export const SESSION_COOKIE_NAME = '__Host-nw_session';

export interface WebSessionInfo {
  id: string;
  csrfToken: string;
  expiresAt: number;
}

interface DbWebSession {
  id: string;
  token_hash: string;
  csrf_token: string;
  created_at: number;
  expires_at: number;
}

/** 建表（幂等），initDB 后调用；web_sessions 永不加入 ALLOWED_TABLES */
export function ensureWebSessionTable(): void {
  run(`CREATE TABLE IF NOT EXISTS web_sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  run('CREATE INDEX IF NOT EXISTS idx_web_sessions_expires ON web_sessions(expires_at)');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * 校验 WEB_PASSWORD_HASH（格式 scrypt:N:r:p:saltB64:hashB64）
 * 使用 timingSafeEqual 防时序侧信道
 */
export function verifyWebPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || N <= 0 || r <= 0 || p <= 0) return false;
  try {
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    const actual = scryptSync(password, salt, expected.length, { N, r, p });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** 清理过期会话（登录时与定期任务调用） */
export function deleteExpiredSessions(): void {
  withWriteTransaction(() => {
    run('DELETE FROM web_sessions WHERE expires_at <= ?', [now()]);
  });
}

/** 创建新会话：清理过期 + 限制最大并发数 + 插入，单事务原子完成并落盘 */
export function createWebSession(): { token: string; session: WebSessionInfo } {
  const token = randomBytes(32).toString('base64url');
  const session: WebSessionInfo = {
    id: generateId(),
    csrfToken: randomBytes(32).toString('hex'),
    expiresAt: now() + getWebSessionTtlSeconds()
  };

  withWriteTransaction(() => {
    run('DELETE FROM web_sessions WHERE expires_at <= ?', [now()]);
    run('INSERT INTO web_sessions (id, token_hash, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', [
      session.id, sha256(token), session.csrfToken, now(), session.expiresAt
    ]);
    // 单用户场景：只保留最新的 N 个会话，挤掉最旧的（rowid 即插入顺序，秒级时间戳同秒内不可靠）
    const rows = query<{ id: string }>('SELECT id FROM web_sessions ORDER BY rowid DESC');
    for (const stale of rows.slice(WEB_MAX_ACTIVE_SESSIONS)) {
      run('DELETE FROM web_sessions WHERE id = ?', [stale.id]);
    }
  });

  return { token, session };
}

/** 注销：服务端立即删除会话行 */
export function deleteWebSession(sessionId: string): void {
  withWriteTransaction(() => {
    run('DELETE FROM web_sessions WHERE id = ?', [sessionId]);
  });
}

/** 从请求 Cookie 头解析会话令牌 */
export function readSessionCookie(req: { headers: Record<string, unknown> }): string | null {
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== 'string') return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE_NAME) {
      return part.slice(eq + 1).trim() || null;
    }
  }
  return null;
}

/** 校验令牌并返回会话信息；无效/过期返回 null（过期的顺带删除） */
export function resolveWebSession(req: { headers: Record<string, unknown> }): WebSessionInfo | null {
  const token = readSessionCookie(req);
  if (!token) return null;
  const rows = query<DbWebSession>('SELECT * FROM web_sessions WHERE token_hash = ?', [sha256(token)]);
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at <= now()) {
    deleteWebSession(row.id);
    return null;
  }
  return { id: row.id, csrfToken: row.csrf_token, expiresAt: row.expires_at };
}

/** 登录成功响应的 Set-Cookie 值 */
export function serializeSessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

/** 注销时清空 Cookie */
export function serializeClearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
