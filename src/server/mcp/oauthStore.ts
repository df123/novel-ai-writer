// OAuth 持久化存储:客户端注册与令牌落 SQLite,服务重启后 ChatGPT 无需重新授权
// 内存 Map 作热缓存,写穿/删穿到库;首次访问时懒加载
// 所有写操作必须经 withWriteTransaction:sql.js 的 run() 只改内存,COMMIT 后的 saveDB() 才真正落盘
import { query, run } from '../db';
import { withWriteTransaction } from '../db/transaction';

export interface StoredOAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  clientName: string;
  authMethod: string;
  createdAt: number;
}

export interface StoredOAuthToken {
  token: string;
  kind: 'access' | 'refresh';
  clientId: string;
  expiresAt: number;
}

let tablesReady = false;

/** 建表(幂等);认证内部表不加入 ALLOWED_TABLES,不在 DatabasePanel 暴露 */
function ensureTables(): void {
  if (tablesReady) {
    return;
  }
  run(`CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id TEXT PRIMARY KEY,
    client_secret TEXT NOT NULL,
    redirect_uris TEXT NOT NULL,
    client_name TEXT NOT NULL,
    auth_method TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  run(`CREATE TABLE IF NOT EXISTS oauth_tokens (
    token TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    client_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  run('CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at)');
  tablesReady = true;
}

/** 加载全部客户端注册记录 */
export function loadClients(): StoredOAuthClient[] {
  ensureTables();
  const rows = query<{ client_id: string; client_secret: string; redirect_uris: string; client_name: string; auth_method: string; created_at: number }>(
    'SELECT * FROM oauth_clients'
  );
  return rows.map(r => ({
    clientId: r.client_id,
    clientSecret: r.client_secret,
    redirectUris: JSON.parse(r.redirect_uris) as string[],
    clientName: r.client_name,
    authMethod: r.auth_method,
    createdAt: r.created_at
  }));
}

/** 写入/更新客户端注册(事务提交后落盘) */
export function saveClient(client: StoredOAuthClient): void {
  ensureTables();
  withWriteTransaction(() => {
    run(
      'INSERT OR REPLACE INTO oauth_clients (client_id, client_secret, redirect_uris, client_name, auth_method, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [client.clientId, client.clientSecret, JSON.stringify(client.redirectUris), client.clientName, client.authMethod, client.createdAt]
    );
  });
}

/** 加载未过期令牌,顺带清理过期行(清理也落盘) */
export function loadTokens(): StoredOAuthToken[] {
  ensureTables();
  const nowMs = Date.now();
  withWriteTransaction(() => {
    run('DELETE FROM oauth_tokens WHERE expires_at < ?', [nowMs]);
  });
  return query<{ token: string; kind: string; client_id: string; expires_at: number }>(
    'SELECT * FROM oauth_tokens WHERE expires_at >= ?',
    [nowMs]
  ).map(r => ({
    token: r.token,
    kind: r.kind as 'access' | 'refresh',
    clientId: r.client_id,
    expiresAt: r.expires_at
  }));
}

/** 写入令牌(事务提交后落盘) */
export function saveToken(token: StoredOAuthToken): void {
  ensureTables();
  withWriteTransaction(() => {
    run(
      'INSERT OR REPLACE INTO oauth_tokens (token, kind, client_id, expires_at) VALUES (?, ?, ?, ?)',
      [token.token, token.kind, token.clientId, token.expiresAt]
    );
  });
}

/** 原子写入一对 access/refresh 令牌(同一事务,避免只落一半) */
export function saveTokenPair(access: StoredOAuthToken, refresh: StoredOAuthToken): void {
  ensureTables();
  withWriteTransaction(() => {
    run(
      'INSERT OR REPLACE INTO oauth_tokens (token, kind, client_id, expires_at) VALUES (?, ?, ?, ?)',
      [access.token, access.kind, access.clientId, access.expiresAt]
    );
    run(
      'INSERT OR REPLACE INTO oauth_tokens (token, kind, client_id, expires_at) VALUES (?, ?, ?, ?)',
      [refresh.token, refresh.kind, refresh.clientId, refresh.expiresAt]
    );
  });
}

/** 删除令牌(过期清理/吊销,事务提交后落盘) */
export function deleteToken(token: string): void {
  ensureTables();
  withWriteTransaction(() => {
    run('DELETE FROM oauth_tokens WHERE token = ?', [token]);
  });
}

/**
 * 原子轮换 refresh token:删除旧 refresh + 写入新 access/refresh 在同一事务完成
 * 任一步失败整体回滚(旧 refresh 保持可用,客户端可重试),杜绝"旧已删、新未写"的半完成状态
 */
export function rotateRefreshToken(oldRefresh: string, newAccess: StoredOAuthToken, newRefresh: StoredOAuthToken): void {
  ensureTables();
  withWriteTransaction(() => {
    run('DELETE FROM oauth_tokens WHERE token = ?', [oldRefresh]);
    run(
      'INSERT OR REPLACE INTO oauth_tokens (token, kind, client_id, expires_at) VALUES (?, ?, ?, ?)',
      [newAccess.token, newAccess.kind, newAccess.clientId, newAccess.expiresAt]
    );
    run(
      'INSERT OR REPLACE INTO oauth_tokens (token, kind, client_id, expires_at) VALUES (?, ?, ?, ?)',
      [newRefresh.token, newRefresh.kind, newRefresh.clientId, newRefresh.expiresAt]
    );
  });
}
