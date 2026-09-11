// 导出文件短期下载：单次有效 + 10 分钟过期的令牌，不暴露本地文件路径
import { randomBytes } from 'crypto';

export interface DownloadPayload {
  content: string;
  mimeType: string;
  filename: string;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const downloads = new Map<string, DownloadPayload>();

/** 创建下载令牌 */
export function createDownload(content: string, mimeType: string, filename: string): { token: string; expiresInSeconds: number } {
  // 顺手清理过期条目
  const nowMs = Date.now();
  for (const [key, payload] of downloads) {
    if (payload.expiresAt < nowMs) {
      downloads.delete(key);
    }
  }
  const token = randomBytes(24).toString('hex');
  downloads.set(token, { content, mimeType, filename, expiresAt: nowMs + TTL_MS });
  return { token, expiresInSeconds: Math.floor(TTL_MS / 1000) };
}

/** 消费下载令牌（单次有效），无效或过期返回 null */
export function consumeDownload(token: string): DownloadPayload | null {
  const payload = downloads.get(token);
  if (!payload) {
    return null;
  }
  downloads.delete(token);
  if (payload.expiresAt < Date.now()) {
    return null;
  }
  return payload;
}
