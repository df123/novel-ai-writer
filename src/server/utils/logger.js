// 日志工具

/**
 * 记录错误
 * @param {string} context - 错误上下文（如路由路径）
 * @param {Error} error - 错误对象
 */
function logError(context, error) {
  console.error(`[${context}] Error:`, error);
}

/**
 * 记录调试信息
 * @param {string} context - 调试上下文
 * @param {any} data - 调试数据
 */
function logDebug(context, data) {
  console.log(`[${context}] Debug:`, data);
}

module.exports = {
  logError,
  logDebug
};
