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
 * 估算文本的 token 数量
 * 
 * 基于字符编码进行估算，不使用实际的 tokenizer
 * 适用于中文和英文混合文本的快速估算
 * 
 * 估算规则：
 * - 中文字符（CJK 统一汉字区）：1.3 tokens
 * - 日文标点符号：1 token
 * - 全角字符：1.2 tokens
 * - ASCII 字符：0.25 tokens
 * - 其他字符：0.5 tokens
 * 
 * @param text - 要估算的文本
 * @returns 估算的 token 数量
 * 
 * @example
 * ```typescript
 * estimateTokens('你好，世界'); // 约 3-4 tokens
 * estimateTokens('Hello, World'); // 约 3 tokens
 * ```
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  let tokens = 0;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    
    // 中文字符（CJK 统一汉字区 U+4E00 - U+9FFF）
    if (charCode >= 0x4e00 && charCode <= 0x9fff) {
      tokens += 1.3;
    } 
    // 日文标点符号（CJK 符号和标点 U+3000 - U+303F）
    else if (charCode >= 0x3000 && charCode <= 0x303f) {
      tokens += 1;
    } 
    // 全角字符（半角及全角形式 U+FF00 - U+FFEF）
    else if (charCode >= 0xff00 && charCode <= 0xffef) {
      tokens += 1.2;
    } 
    // ASCII 可打印字符（U+0020 - U+007E）
    else if (charCode >= 0x20 && charCode <= 0x7e) {
      tokens += 0.25;
    } 
    // 其他字符
    else {
      tokens += 0.5;
    }
  }
  
  return Math.ceil(tokens);
}

/**
 * 估算单条消息的 token 数量
 * 
 * 包含角色和内容的 token 估算
 * 
 * @param message - 消息对象，包含 role 和 content
 * @returns 估算的 token 数量
 * 
 * @example
 * ```typescript
 * estimateMessageTokens({ role: 'user', content: '你好' }); // 约 6 tokens
 * ```
 */
export function estimateMessageTokens(message: { role?: string; content?: string }): number {
  // 消息基础开销（JSON 格式、换行符等）
  let tokens = 4;
  
  if (message.role) {
    tokens += estimateTokens(message.role);
  }
  
  if (message.content) {
    tokens += estimateTokens(message.content);
  }
  
  return tokens;
}

/**
 * 估算整个对话的 token 数量
 *
 * 包含所有消息的 token 估算总和
 *
 * @param messages - 消息数组
 * @returns 估算的总 token 数量
 *
 * @example
 * ```typescript
 * estimateConversationTokens([
 *   { role: 'user', content: '你好' },
 *   { role: 'assistant', content: '你好！有什么可以帮助你的吗？' }
 * ]); // 约 15-20 tokens
 * ```
 */
export function estimateConversationTokens(messages: { role?: string; content?: string }[]): number {
  // 对话基础开销（JSON 数组格式等）
  let totalTokens = 3;

  for (const message of messages) {
    totalTokens += estimateMessageTokens(message);
  }

  return Math.ceil(totalTokens);
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
