// Database Management API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { ALLOWED_TABLES } from '../config';
import { validateAndConvertValue, isValidColumnName, isValidTableName } from '../utils/validators';
import { asyncHandler } from '../middleware/errorHandler';
import type { TableInfo, ColumnInfo, QueryRequest } from '@shared/types';

const router: Router = express.Router();

/**
 * PRAGMA table_info 返回的列信息接口
 */
interface PragmaColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
  dflt_value: unknown;
}

/**
 * 查询表数据查询参数接口
 */
interface GetTableDataQuery {
  page?: string;
  pageSize?: string;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

/**
 * 获取所有表信息
 */
router.get('/tables', asyncHandler(async (_req: Request, res: Response) => {
  // 获取所有表
  const tables = query("SELECT * FROM sqlite_master WHERE type='table' ORDER BY name");

  const result: TableInfo[] = [];

  for (const table of tables) {
    // 跳过 sqlite 系统表
    const tableName = table.name as string;
    if (tableName.startsWith('sqlite_')) {
      continue;
    }

    // 获取表的列信息
    const columns = query(`PRAGMA table_info(${tableName})`) as PragmaColumnInfo[];
    const formattedColumns: ColumnInfo[] = columns.map(col => ({
      name: col.name,
      type: col.type,
      notNull: col.notnull === 1,
      primaryKey: col.pk === 1,
      defaultValue: col.dflt_value
    }));

    // 获取表的行数
    const countResult = query(`SELECT COUNT(*) as count FROM ${tableName}`) as { count: number }[];
    const rowCount = countResult[0].count;

    result.push({
      name: tableName,
      columns: formattedColumns,
      rowCount: rowCount
    });
  }

  res.json({ tables: result });
}));

/**
 * 查询表数据（支持分页和排序）
 */
router.get('/tables/:tableName', asyncHandler(async (req: Request, res: Response) => {
  const { tableName } = req.params;
  const { page, pageSize, orderBy, order } = req.query as GetTableDataQuery;

  // 验证表名
  if (!isValidTableName(tableName, ALLOWED_TABLES)) {
    res.status(400).json({ error: '无效的表名' });
    return;
  }

  // 获取表的列信息以确定默认排序列
  const columns = query(`PRAGMA table_info(${tableName})`) as PragmaColumnInfo[];
  const primaryColumn = columns.find(col => col.pk === 1);
  const defaultOrderBy = primaryColumn ? primaryColumn.name : 'id';
  const validColumnNames = columns.map(col => col.name);

  // 验证 orderBy 参数是否为有效列名
  let orderByColumn = orderBy || defaultOrderBy;
  if (!validColumnNames.includes(orderByColumn!) || !isValidColumnName(orderByColumn!)) {
    orderByColumn = defaultOrderBy;
  }

  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  // 验证分页参数
  const pageNum = page ? parseInt(page) : 1;
  const pageSizeNum = pageSize ? parseInt(pageSize) : 20;

  if (pageNum < 1 || pageSizeNum < 1 || pageSizeNum > 100) {
    res.status(400).json({ error: '无效的分页参数' });
    return;
  }

  // 获取总数
  const countResult = query(`SELECT COUNT(*) as total FROM ${tableName}`) as { total: number }[];
  const total = countResult[0].total;
  const totalPages = Math.ceil(total / pageSizeNum);

  // 构建查询
  const offset = (pageNum - 1) * pageSizeNum;
  const data = query(
    `SELECT * FROM ${tableName} ORDER BY ${orderByColumn} ${sortOrder} LIMIT ? OFFSET ?`,
    [pageSizeNum, offset]
  );

  res.json({
    data: data,
    pagination: {
      page: pageNum,
      pageSize: pageSizeNum,
      total: total,
      totalPages: totalPages
    }
  });
}));

/**
 * 执行自定义查询（只读）
 */
router.post('/query', asyncHandler(async (req: Request, res: Response) => {
  const { sql, params } = req.body as QueryRequest;

  // 验证 SQL 语句
  if (!sql || typeof sql !== 'string') {
    res.status(400).json({ error: 'SQL 查询语句是必需的' });
    return;
  }

  // 验证是否为 SELECT 查询
  const trimmedSql = sql.trim().toUpperCase();
  if (!trimmedSql.startsWith('SELECT')) {
    res.status(400).json({ error: '只允许 SELECT 查询' });
    return;
  }

  // 执行查询
  const result = query(sql, params || []);

  res.json(result);
}));

/**
 * 插入数据
 */
router.post('/tables/:tableName', asyncHandler(async (req: Request, res: Response) => {
  const { tableName } = req.params;
  const data = req.body as Record<string, unknown>;

  // 验证表名
  if (!isValidTableName(tableName, [...ALLOWED_TABLES])) {
    res.status(400).json({ error: '无效的表名' });
    return;
  }

  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: '请求体是必需的' });
    return;
  }

  // 获取表的列信息
  const columns = query(`PRAGMA table_info(${tableName})`) as PragmaColumnInfo[];
  const columnNames = columns.map(col => col.name);

  // 验证数据字段是否有效
  for (const key of Object.keys(data)) {
    if (!columnNames.includes(key)) {
      res.status(400).json({ error: `无效的列: ${key}` });
      return;
    }
  }

  // 验证数据类型和约束
  for (const key of Object.keys(data)) {
    const column = columns.find(col => col.name === key);
    if (!column) continue;

    const value = data[key];
    const columnType = column.type?.toUpperCase();

    try {
      data[key] = validateAndConvertValue(value, columnType as any, column.notnull === 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '验证失败';
      res.status(400).json({ error: `列 ${key}: ${errorMessage}` });
      return;
    }
  }

  // 自动生成 id（如果表有 id 字段且为空）
  if (columnNames.includes('id') && !data.id) {
    data.id = generateId();
  }

  // 自动设置时间戳（如果表有 created_at/updated_at 字段）
  if (columnNames.includes('created_at') && !data.created_at) {
    data.created_at = now();
  }
  if (columnNames.includes('updated_at') && !data.updated_at) {
    data.updated_at = now();
  }

  // 构建 INSERT 语句
  const fields = Object.keys(data);
  const values = Object.values(data);
  const placeholders = fields.map(() => '?').join(', ');

  const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
  run(sql, values);

  // 保存数据库
  saveDB();

  // 返回插入的数据
  const insertedData = query(`SELECT * FROM ${tableName} WHERE id = ?`, [data.id]);
  if (insertedData.length > 0) {
    res.status(201).json(insertedData[0]);
  } else {
    res.status(201).json(data);
  }
}));

/**
 * 更新数据
 */
router.put('/tables/:tableName/:id', asyncHandler(async (req: Request, res: Response) => {
  const { tableName, id } = req.params;
  const data = req.body as Record<string, unknown>;

  // 验证表名
  if (!isValidTableName(tableName, [...ALLOWED_TABLES])) {
    res.status(400).json({ error: '无效的表名' });
    return;
  }

  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: '请求体是必需的' });
    return;
  }

  // 获取表的列信息以确定主键列
  const columns = query(`PRAGMA table_info(${tableName})`) as PragmaColumnInfo[];
  const primaryColumn = columns.find(col => col.pk === 1);
  const primaryColumnName = primaryColumn ? primaryColumn.name : 'id';
  const columnNames = columns.map(col => col.name);

  // 检查记录是否存在
  const existing = query(`SELECT * FROM ${tableName} WHERE ${primaryColumnName} = ?`, [id]);
  if (existing.length === 0) {
    res.status(404).json({ error: '记录未找到' });
    return;
  }

  // 验证数据字段是否有效
  for (const key of Object.keys(data)) {
    if (!columnNames.includes(key)) {
      res.status(400).json({ error: `无效的列: ${key}` });
      return;
    }
  }

  // 验证数据类型和约束
  for (const key of Object.keys(data)) {
    const column = columns.find(col => col.name === key);
    if (!column) continue;

    const value = data[key];
    const columnType = column.type?.toUpperCase();

    try {
      data[key] = validateAndConvertValue(value, columnType as any, column.notnull === 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '验证失败';
      res.status(400).json({ error: `列 ${key}: ${errorMessage}` });
      return;
    }
  }

  // 自动设置 updated_at（如果表有该字段）
  if (columnNames.includes('updated_at')) {
    data.updated_at = now();
  }

  // 构建 UPDATE 语句
  const fields = Object.keys(data);
  const values = Object.values(data);
  const setClause = fields.map(field => `${field} = ?`).join(', ');

  const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${primaryColumnName} = ?`;
  run(sql, [...values, id]);

  // 保存数据库
  saveDB();

  // 返回更新后的数据
  const updatedData = query(`SELECT * FROM ${tableName} WHERE ${primaryColumnName} = ?`, [id]);
  res.json(updatedData[0]);
}));

/**
 * 删除数据
 */
router.delete('/tables/:tableName/:id', asyncHandler(async (req: Request, res: Response) => {
  const { tableName, id } = req.params;

  // 验证表名
  if (!isValidTableName(tableName, [...ALLOWED_TABLES])) {
    res.status(400).json({ error: '无效的表名' });
    return;
  }

  // 获取表的列信息以确定主键列
  const columns = query(`PRAGMA table_info(${tableName})`) as PragmaColumnInfo[];
  const primaryColumn = columns.find(col => col.pk === 1);
  const primaryColumnName = primaryColumn ? primaryColumn.name : 'id';

  // 检查记录是否存在
  const existing = query(`SELECT * FROM ${tableName} WHERE ${primaryColumnName} = ?`, [id]);
  if (existing.length === 0) {
    res.status(404).json({ error: '记录未找到' });
    return;
  }

  // 删除记录
  run(`DELETE FROM ${tableName} WHERE ${primaryColumnName} = ?`, [id]);

  // 保存数据库
  saveDB();

  res.status(204).send();
}));

export default router;
