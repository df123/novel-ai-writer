/**
 * 共享工具函数
 * 
 * 本文件包含前端和后端共享的工具函数
 */

/**
 * 生成唯一标识符
 * 
 * 使用时间戳和随机字符串组合生成一个临时 ID
 * 主要用于前端乐观更新，实际 ID 由后端使用 crypto.randomUUID() 生成
 * 
 * @returns 格式为 "时间戳-随机字符串" 的 ID，例如 "1234567890-abc123def"
 * 
 * @example
 * ```typescript
 * const tempId = generateId(); // "1234567890-abc123def"
 * ```
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化时间戳为本地化日期时间字符串
 * 
 * 自动检测时间戳是秒级还是毫秒级，并转换为本地日期时间格式
 * 
 * @param timestamp - 时间戳（秒或毫秒）
 * @returns 格式化的日期时间字符串，例如 "2024/3/16 12:00:00"
 * 
 * @example
 * ```typescript
 * formatTimestamp(1710576000); // "2024/3/16 12:00:00" (秒级)
 * formatTimestamp(1710576000000); // "2024/3/16 12:00:00" (毫秒级)
 * ```
 */
export function formatTimestamp(timestamp: number): string {
  const isSeconds = timestamp < 10000000000;
  const milliseconds = isSeconds ? timestamp * 1000 : timestamp;
  return new Date(milliseconds).toLocaleString('zh-CN');
}

/**
 * 格式化日期字符串为本地化日期格式
 * 
 * @param dateStr - 日期字符串
 * @returns 格式化的日期字符串，例如 "2024/3/16"
 * 
 * @example
 * ```typescript
 * formatDate('2024-03-16'); // "2024/3/16"
 * formatDate(new Date().toISOString()); // "2024/3/16"
 * ```
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

/**
 * 格式化删除时间戳为本地化日期时间字符串
 *
 * @param timestamp - 删除时间戳（秒）
 * @returns 格式化的日期时间字符串，例如 "2024/03/16 12:00"
 *
 * @example
 * ```typescript
 * formatDeletedAt(1710576000); // "2024/03/16 12:00"
 * formatDeletedAt(undefined); // "未知时间"
 * ```
 */
export function formatDeletedAt(timestamp: number | undefined): string {
  if (!timestamp || timestamp < 1000000) {
    return '未知时间';
  }
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      return '时间无效';
    }
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '时间解析错误';
  }
}
