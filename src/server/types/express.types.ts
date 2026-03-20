/**
 * Express 相关类型定义
 */

import { Express, Request, Response, NextFunction } from 'express';
import { DatabaseConnection } from './db.types';

/**
 * 扩展 Express Request 类型
 * 添加数据库连接等自定义属性
 */
export interface AppRequest extends Request {
  /** 数据库连接实例 */
  db?: DatabaseConnection;
  
  /** 请求开始时间戳 */
  startTime?: number;
  
  /** 用户 ID（如果实现了认证） */
  userId?: string;
}

/**
 * 扩展 Express Response 类型
 * 添加自定义响应方法
 */
export interface AppResponse extends Response {
  /** 成功响应 */
  success?(data?: any, message?: string): this;
  
  /** 错误响应 */
  error?(message: string, code?: number): this;
}

/**
 * 自定义中间件函数类型
 */
export type MiddlewareFunction = (
  req: AppRequest,
  res: AppResponse,
  next: NextFunction
) => void | Promise<void>;

/**
 * 异步中间件函数类型
 */
export type AsyncMiddlewareFunction = (
  req: AppRequest,
  res: AppResponse,
  next: NextFunction
) => Promise<void>;

/**
 * 错误处理中间件函数类型
 */
export type ErrorMiddlewareFunction = (
  err: Error,
  req: AppRequest,
  res: AppResponse,
  next: NextFunction
) => void;

/**
 * 路由处理器函数类型
 */
export type RouteHandler = (
  req: AppRequest,
  res: AppResponse
) => void | Promise<void>;

/**
 * 异步路由处理器函数类型
 */
export type AsyncRouteHandler = (
  req: AppRequest,
  res: AppResponse
) => Promise<void>;

/**
 * Express 应用程序类型
 */
export type App = Express;
