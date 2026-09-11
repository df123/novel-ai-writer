import { NextFunction, RequestHandler } from 'express';
import {
  AppRequest,
  AppResponse,
  ErrorMiddlewareFunction,
  AsyncMiddlewareFunction,
  RouteHandler
} from '../types/express.types';
import { DomainError } from '../services/domain/errors';

/**
 * 错误处理中间件
 * DomainError 按其错误码映射 HTTP 状态码，其余按 statusCode 或 500 处理
 */
export const errorHandler: ErrorMiddlewareFunction = (
  err: Error,
  _req: AppRequest,
  res: AppResponse,
  _next: NextFunction
): void => {
  if (err instanceof DomainError) {
    res.status(err.httpStatus).json({
      error: err.message,
      code: err.code,
      ...(err.recoveryHint ? { recovery_hint: err.recoveryHint } : {})
    });
    return;
  }

  console.error('Error:', err);

  const statusCode = (err as any).statusCode || 500;
  const message = err.message || '内部服务器错误';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 异步路由包装器，自动捕获错误
 */
export const asyncHandler = (
  fn: AsyncMiddlewareFunction
): RequestHandler => {
  return (req: AppRequest, res: AppResponse, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 错误处理
 */
export const notFoundHandler: RouteHandler = (
  _req: AppRequest,
  res: AppResponse
): void => {
  res.status(404).json({ error: '未找到' });
};
