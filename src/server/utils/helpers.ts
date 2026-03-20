// 通用工具函数
import { randomUUID } from 'crypto';

/**
 * 时间线内容解析结果
 */
export interface TimelineContent {
  date: string;
  description: string;
}

/**
 * 生成 UUID
 * @returns UUID 字符串
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * 获取当前 Unix 时间戳（秒级）
 * @returns Unix 时间戳
 */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 解析时间线内容格式
 * @param content - 时间线内容
 * @returns 包含 date 和 description 的对象
 */
export function parseTimelineContent(content: string): TimelineContent {
  if (!content) {
    return { date: '', description: '' };
  }

  const match = content.match(/Date: (.*?)\nDescription: (.*)/s);
  if (match) {
    return { date: match[1], description: match[2] || '' };
  }

  return { date: '', description: content };
}
