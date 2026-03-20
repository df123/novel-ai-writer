/**
 * 数据库相关类型定义
 */

/**
 * 数据库连接类型
 * 表示 sql.js 数据库实例
 */
export type DatabaseConnection = any;

/**
 * 查询结果类型
 * 表示数据库查询的结果集
 */
export interface QueryResult {
  /** 查询返回的数据行 */
  rows: any[];
  
  /** 查询影响的行数 */
  changes?: number;
  
  /** 最后插入的行 ID */
  lastInsertRowid?: number;
}

/**
 * 数据库错误类型
 * 表示数据库操作过程中发生的错误
 */
export interface DatabaseError extends Error {
  /** 错误类型 */
  type: 'CONNECTION_ERROR' | 'QUERY_ERROR' | 'SCHEMA_ERROR' | 'CONSTRAINT_ERROR';
  
  /** SQL 语句（如果适用） */
  sql?: string;
  
  /** 查询参数（如果适用） */
  params?: any[];
  
  /** 原始错误对象 */
  originalError?: unknown;
}

/**
 * 数据库事务类型
 * 表示数据库事务操作
 */
export interface DatabaseTransaction {
  /** 执行查询 */
  query(sql: string, params?: any[]): QueryResult;
  
  /** 执行更新/插入/删除 */
  run(sql: string, params?: any[]): QueryResult;
  
  /** 提交事务 */
  commit(): void;
  
  /** 回滚事务 */
  rollback(): void;
}

/**
 * 数据库配置类型
 * 表示数据库初始化配置
 */
export interface DatabaseConfig {
  /** 数据库文件路径 */
  path: string;
  
  /** 是否创建数据库（如果不存在） */
  create: boolean;
  
  /** 是否只读模式 */
  readOnly?: boolean;
}
