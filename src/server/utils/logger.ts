// 日志工具

/**
 * 记录错误
 * @param context - 错误上下文（如路由路径）
 * @param error - 错误对象
 */
export function logError(context: string, error: Error): void {
  console.error(`[${context}] Error:`, error);
}

/**
 * 记录调试信息
 * @param context - 调试上下文
 * @param data - 调试数据
 */
export function logDebug(context: string, data: unknown): void {
  console.log(`[${context}] Debug:`, data);
}
