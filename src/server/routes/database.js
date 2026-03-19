// Database Management API 路由
const express = require('express');
const router = express.Router();
const { query, run, saveDB } = require('../db');
const { generateId, now } = require('../utils/helpers');
const { ALLOWED_TABLES } = require('../config');
const { logError } = require('../utils/logger');
const { validateAndConvertValue, isValidColumnName, isValidTableName } = require('../utils/validators');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取所有表信息
router.get('/tables', asyncHandler(async (req, res) => {
  // 获取所有表
  const tables = query("SELECT * FROM sqlite_master WHERE type='table' ORDER BY name");

  const result = [];

  for (const table of tables) {
    // 跳过 sqlite 系统表
    if (table.name.startsWith('sqlite_')) {
      continue;
    }

    // 获取表的列信息
    const columns = query(`PRAGMA table_info(${table.name})`);
    const formattedColumns = columns.map(col => ({
      name: col.name,
      type: col.type,
      notNull: col.notnull === 1,
      primaryKey: col.pk === 1,
      defaultValue: col.dflt_value
    }));

    // 获取表的行数
    const countResult = query(`SELECT COUNT(*) as count FROM ${table.name}`);
    const rowCount = countResult[0].count;

    result.push({
      name: table.name,
      columns: formattedColumns,
      rowCount: rowCount
    });
  }

  res.json({ tables: result });
}));

// 查询表数据（支持分页和排序）
router.get('/tables/:tableName', asyncHandler(async (req, res) => {
  const { tableName } = req.params;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;

  // 验证表名
  if (!isValidTableName(tableName, ALLOWED_TABLES)) {
    return res.status(400).json({ error: '无效的表名' });
  }

  // 获取表的列信息以确定默认排序列
  const columns = query(`PRAGMA table_info(${tableName})`);
  const primaryColumn = columns.find(col => col.pk === 1);
  const defaultOrderBy = primaryColumn ? primaryColumn.name : 'id';
  const validColumnNames = columns.map(col => col.name);

  // 验证 orderBy 参数是否为有效列名
  let orderBy = req.query.orderBy || defaultOrderBy;
  if (!validColumnNames.includes(orderBy) || !isValidColumnName(orderBy)) {
    orderBy = defaultOrderBy;
  }

  const order = req.query.order === 'desc' ? 'DESC' : 'ASC';

  // 验证分页参数
  if (page < 1 || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ error: '无效的分页参数' });
  }

  // 获取总数
  const countResult = query(`SELECT COUNT(*) as total FROM ${tableName}`);
  const total = countResult[0].total;
  const totalPages = Math.ceil(total / pageSize);

  // 构建查询
  const offset = (page - 1) * pageSize;
  const data = query(`SELECT * FROM ${tableName} ORDER BY ${orderBy} ${order} LIMIT ? OFFSET ?`, [pageSize, offset]);

  res.json({
    data: data,
    pagination: {
      page: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages
    }
  });
}));

// 执行自定义查询（只读）
router.post('/query', asyncHandler(async (req, res) => {
  const { sql, params } = req.body;

  // 验证 SQL 语句
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'SQL 查询语句是必需的' });
  }

  // 验证是否为 SELECT 查询
  const trimmedSql = sql.trim().toUpperCase();
  if (!trimmedSql.startsWith('SELECT')) {
    return res.status(400).json({ error: '只允许 SELECT 查询' });
  }

  // 执行查询
  const result = query(sql, params || []);

  res.json(result);
}));

// 插入数据
router.post('/tables/:tableName', asyncHandler(async (req, res) => {
  const { tableName } = req.params;
  const data = req.body;

  // 验证表名
  if (!isValidTableName(tableName, ALLOWED_TABLES)) {
    return res.status(400).json({ error: '无效的表名' });
  }

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '请求体是必需的' });
  }

  // 获取表的列信息
  const columns = query(`PRAGMA table_info(${tableName})`);
  const columnNames = columns.map(col => col.name);

  // 验证数据字段是否有效
  for (const key of Object.keys(data)) {
    if (!columnNames.includes(key)) {
      return res.status(400).json({ error: `无效的列: ${key}` });
    }
  }

  // 验证数据类型和约束
  for (const key of Object.keys(data)) {
    const column = columns.find(col => col.name === key);
    if (!column) continue;

    const value = data[key];
    const columnType = column.type?.toUpperCase();

    try {
      data[key] = validateAndConvertValue(value, columnType, column.notnull);
    } catch (error) {
      return res.status(400).json({ error: `列 ${key}: ${error.message}` });
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

// 更新数据
router.put('/tables/:tableName/:id', asyncHandler(async (req, res) => {
  const { tableName, id } = req.params;
  const data = req.body;

  // 验证表名
  if (!isValidTableName(tableName, ALLOWED_TABLES)) {
    return res.status(400).json({ error: '无效的表名' });
  }

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '请求体是必需的' });
  }

  // 获取表的列信息以确定主键列
  const columns = query(`PRAGMA table_info(${tableName})`);
  const primaryColumn = columns.find(col => col.pk === 1);
  const primaryColumnName = primaryColumn ? primaryColumn.name : 'id';
  const columnNames = columns.map(col => col.name);

  // 检查记录是否存在
  const existing = query(`SELECT * FROM ${tableName} WHERE ${primaryColumnName} = ?`, [id]);
  if (existing.length === 0) {
    return res.status(404).json({ error: '记录未找到' });
  }

  // 验证数据字段是否有效
  for (const key of Object.keys(data)) {
    if (!columnNames.includes(key)) {
      return res.status(400).json({ error: `无效的列: ${key}` });
    }
  }

  // 验证数据类型和约束
  for (const key of Object.keys(data)) {
    const column = columns.find(col => col.name === key);
    if (!column) continue;

    const value = data[key];
    const columnType = column.type?.toUpperCase();

    try {
      data[key] = validateAndConvertValue(value, columnType, column.notnull);
    } catch (error) {
      return res.status(400).json({ error: `列 ${key}: ${error.message}` });
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

// 删除数据
router.delete('/tables/:tableName/:id', asyncHandler(async (req, res) => {
  const { tableName, id } = req.params;

  // 验证表名
  if (!isValidTableName(tableName, ALLOWED_TABLES)) {
    return res.status(400).json({ error: '无效的表名' });
  }

  // 获取表的列信息以确定主键列
  const columns = query(`PRAGMA table_info(${tableName})`);
  const primaryColumn = columns.find(col => col.pk === 1);
  const primaryColumnName = primaryColumn ? primaryColumn.name : 'id';

  // 检查记录是否存在
  const existing = query(`SELECT * FROM ${tableName} WHERE ${primaryColumnName} = ?`, [id]);
  if (existing.length === 0) {
    return res.status(404).json({ error: '记录未找到' });
  }

  // 删除记录
  run(`DELETE FROM ${tableName} WHERE ${primaryColumnName} = ?`, [id]);

  // 保存数据库
  saveDB();

  res.status(204).send();
}));

module.exports = router;
