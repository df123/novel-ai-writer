// 数据库初始化和迁移
import * as fs from 'fs';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { dbPath } from '../config';
import { setDatabase, saveDB, query, run } from './queries';
import { getCreateTablesSQL, getMigrationSQLs, getSoftDeleteIndexesSQL, getDefaultPromptTemplates } from './schema';
import { generateId, now } from '../utils/helpers';
import type { DatabaseConnection } from '../types/db.types';

/**
 * 迁移到软删除功能
 * 检查表是否已有 deleted 和 deleted_at 字段，如果没有则添加
 * @returns 是否发生了迁移
 */
async function migrateToSoftDelete(): Promise<boolean> {
  const tables = ['characters', 'timeline_nodes'];
  let migrated = false;

  for (const table of tables) {
    try {
      // 检查表结构
      const tableInfo = query<{ name: string }>(`PRAGMA table_info(${table})`);
      const columnNames = tableInfo.map(col => col.name);

      // 添加 deleted 字段（如果不存在）
      if (!columnNames.includes('deleted')) {
        run(`ALTER TABLE ${table} ADD COLUMN deleted INTEGER DEFAULT 0`);
        migrated = true;
      }

      // 添加 deleted_at 字段（如果不存在）
      if (!columnNames.includes('deleted_at')) {
        run(`ALTER TABLE ${table} ADD COLUMN deleted_at INTEGER DEFAULT NULL`);
        migrated = true;
        // 只在添加字段时执行UPDATE
        run(`UPDATE ${table} SET deleted = 0 WHERE deleted IS NULL`);
      }
    } catch (e) {
      // 捕获字段已存在的错误
      const errorMessage = (e as Error).message?.toLowerCase() || '';
      if (!errorMessage.includes('duplicate column name') &&
          !errorMessage.includes('duplicate') &&
          !errorMessage.includes('already exists')) {
        console.error('软删除迁移错误:', e);
        throw e;
      }
    }
  }

  return migrated;
}

let SQL: SqlJsStatic | null = null;

/**
 * 初始化数据库
 */
export async function initDB(): Promise<DatabaseConnection> {
  SQL = await initSqlJs();

  // 检查数据库文件是否存在
  const isNewDatabase = !fs.existsSync(dbPath);
  let dbInstance: DatabaseConnection;

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // 设置数据库实例
  setDatabase(dbInstance);

  // 始终创建表（如果不存在）
  const createTableSQLs = getCreateTablesSQL();
  for (const sql of createTableSQLs) {
    dbInstance.run(sql);
  }

  // 初始化默认提示词模板
  await initDefaultTemplates();

  // 执行数据库迁移
  await runMigrations();

  // 迁移到软删除功能
  const migrated = await migrateToSoftDelete();

  // 创建软删除索引
  const softDeleteIndexes = getSoftDeleteIndexesSQL();
  for (const sql of softDeleteIndexes) {
    dbInstance.run(sql);
  }

  // 如果数据库是新创建的或者发生了迁移，则需要保存
  if (isNewDatabase || migrated) {
    saveDB();
  }

  return dbInstance;
}

/**
 * 初始化默认提示词模板
 */
async function initDefaultTemplates(): Promise<void> {
  const templatesCount = query<{ count: number }>('SELECT COUNT(*) as count FROM prompt_templates')[0].count;
  if (templatesCount === 0) {
    const defaultTemplates = getDefaultPromptTemplates(generateId, now);
    for (const t of defaultTemplates) {
      run('INSERT INTO prompt_templates (id, name, template, type, created_at) VALUES (?, ?, ?, ?, ?)',
        [t.id, t.name, t.template, t.type, t.created_at]);
    }
  }
}

/**
 * 执行数据库迁移
 */
async function runMigrations(): Promise<void> {
  const migrationSQLs = getMigrationSQLs();
  for (const sql of migrationSQLs) {
    try {
      run(sql);
    } catch (e) {
      // 只捕获字段已存在的错误
      const errorMessage = (e as Error).message?.toLowerCase() || '';
      if (!errorMessage.includes('duplicate column name') &&
          !errorMessage.includes('duplicate') &&
          !errorMessage.includes('already exists')) {
        console.error('数据库迁移错误:', e);
        throw e; // 重新抛出其他错误
      }
    }
  }
}

/**
 * 获取 SQL 构造函数
 * @returns SQL 构造函数
 */
export function getSQL(): SqlJsStatic | null {
  return SQL;
}

// 重新导出查询函数
export { query, run, saveDB, getDatabase } from './queries';
