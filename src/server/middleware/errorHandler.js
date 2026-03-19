// 统一错误处理中间件

/**
 * 错误处理中间件
 * @param {Error} err - 错误对象
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || '内部服务器错误';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * 异步路由包装器，自动捕获错误
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} 包装后的路由处理函数
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 错误处理
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: '未找到' });
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
};
