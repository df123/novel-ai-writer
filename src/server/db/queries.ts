// 数据库查询封装
import * as fs from 'fs';
import { dbPath } from '../config';
import type { DatabaseConnection } from '../types/db.types';

let db: DatabaseConnection | null = null;

/**
 * 设置数据库实例
 * @param databaseInstance - sql.js 数据库实例
 */
export function setDatabase(databaseInstance: DatabaseConnection): void {
  db = databaseInstance;
}

/**
 * 获取数据库实例
 * @returns 数据库实例
 */
export function getDatabase(): DatabaseConnection | null {
  return db;
}

/**
 * 执行 SELECT 查询
 * @param sql - SQL 查询语句
 * @param params - 查询参数
 * @returns 查询结果数组
 */
export function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result: T[] = [];
  while (stmt.step()) {
    result.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return result;
}

/**
 * 执行 INSERT/UPDATE/DELETE 操作
 * @param sql - SQL 语句
 * @param params - 参数
 */
export function run(sql: string, params: unknown[] = []): void {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  db.run(sql, params);
}

/**
 * 持久化数据库到文件
 */
export function saveDB(): void {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}
