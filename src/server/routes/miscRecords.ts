// MiscRecords API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { formatMiscRecord, formatMiscRecordVersion } from '../utils/formatters';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbMiscRecord, DbMiscRecordVersion } from '@shared/types';

const router: Router = express.Router();

/**
 * 创建杂物记录请求体接口
 */
interface CreateMiscRecordRequestBody {
  title: string;
  category?: string;
  content?: string;
}

/**
 * 更新杂物记录请求体接口
 */
interface UpdateMiscRecordRequestBody {
  title?: string;
  category?: string;
  content?: string;
  createVersion?: boolean;
}

/**
 * 查询杂物记录参数接口
 */
interface GetMiscRecordsQuery {
  search?: string;
  category?: string;
}

/**
 * 获取项目的所有杂物记录
 */
router.get('/projects/:projectId/misc-records', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { search, category } = req.query as GetMiscRecordsQuery;

  let sql = 'SELECT * FROM misc_records WHERE project_id = ? AND deleted = 0';
  const params: (string | number)[] = [projectId];

  if (search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY order_index ASC';

  const records = query<DbMiscRecord>(sql, params);
  const formattedRecords = records.map(formatMiscRecord);
  res.json(formattedRecords);
}));

/**
 * 创建杂物记录
 */
router.post('/projects/:projectId/misc-records', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, category, content } =
    req.body as CreateMiscRecordRequestBody;

  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  // 计算 order_index：当前最大值 + 1，无记录时为 0
  const maxOrderResult = query('SELECT MAX(order_index) as maxOrder FROM misc_records WHERE project_id = ?', [projectId]) as { maxOrder: number | null }[];
  const orderIndex = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

  run(
    'INSERT INTO misc_records (id, project_id, title, category, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      projectId,
      title,
      category || null,
      content || null,
      orderIndex,
      createdAt,
      updatedAt
    ]
  );

  saveDB();

  const records = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [id]);
  res.status(201).json(formatMiscRecord(records[0]));
}));

/**
 * 获取单个杂物记录
 */
router.get('/misc-records/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ? AND deleted = 0', [id]);
  if (records.length === 0) {
    res.status(404).json({ error: '杂物记录未找到' });
    return;
  }
  res.json(formatMiscRecord(records[0]));
}));

/**
 * 更新杂物记录
 */
router.put('/misc-records/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, category, content, createVersion } =
    req.body as UpdateMiscRecordRequestBody;
  const updatedAt = now();

  // 检查记录是否存在
  const existingRecords = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [id]);
  if (existingRecords.length === 0) {
    res.status(404).json({ error: '杂物记录未找到' });
    return;
  }

  if (createVersion) {
    const existingRecord = existingRecords[0];
    const versionCount = (
      query('SELECT COUNT(*) as count FROM misc_record_versions WHERE misc_record_id = ?', [id]) as {
        count: number;
      }[]
    )[0].count;
    const newVersion = versionCount + 1;
    const versionId = generateId();

    run(
      'INSERT INTO misc_record_versions (id, misc_record_id, title, category, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        versionId,
        id,
        existingRecord.title,
        existingRecord.category ?? null,
        existingRecord.content ?? null,
        newVersion,
        now()
      ]
    );
  }

  // 构建动态 UPDATE 语句 - 只更新提供的字段
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (category !== undefined) {
    updates.push('category = ?');
    values.push(category);
  }
  if (content !== undefined) {
    updates.push('content = ?');
    values.push(content);
  }

  // 检查是否有字段需要更新（不包括 updated_at）
  if (updates.length === 0) {
    res.json(formatMiscRecord(existingRecords[0]));
    return;
  }

  // 始终更新 updated_at
  updates.push('updated_at = ?');
  values.push(updatedAt);

  // 添加 WHERE 子句参数
  values.push(id);

  const updateSQL = `UPDATE misc_records SET ${updates.join(', ')} WHERE id = ?`;
  run(updateSQL, values);

  saveDB();

  const records = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [id]);
  res.json(formatMiscRecord(records[0]));
}));

/**
 * 删除杂物记录（软删除）
 */
router.delete('/misc-records/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedAt = now();
  run('UPDATE misc_records SET deleted = 1, deleted_at = ? WHERE id = ?', [deletedAt, id]);
  saveDB();
  res.status(204).send();
}));

/**
 * 恢复杂物记录
 */
router.post('/misc-records/:id/restore', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [id]);
  if (records.length === 0) {
    res.status(404).json({ error: '杂物记录未找到' });
    return;
  }
  run('UPDATE misc_records SET deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
  saveDB();
  const restoredRecords = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [id]);
  res.json(formatMiscRecord(restoredRecords[0]));
}));

/**
 * 永久删除杂物记录
 */
router.delete('/misc-records/:id/permanent', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [id]);
  if (records.length === 0) {
    res.status(404).json({ error: '杂物记录未找到' });
    return;
  }
  if (records[0].deleted === 0) {
    res.status(400).json({ error: '只能永久删除已软删除的杂物记录' });
    return;
  }
  run('DELETE FROM misc_records WHERE id = ?', [id]);
  saveDB();
  res.status(204).send();
}));

/**
 * 获取项目的杂物记录回收站
 */
router.get('/projects/:projectId/misc-records/trash', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const records = query<DbMiscRecord>(
    'SELECT * FROM misc_records WHERE project_id = ? AND deleted = 1 ORDER BY deleted_at DESC',
    [projectId]
  );
  const formattedRecords = records.map(formatMiscRecord);
  res.json(formattedRecords);
}));

/**
 * 获取版本历史
 */
router.get('/misc-records/:recordId/versions', asyncHandler(async (req: Request, res: Response) => {
  const { recordId } = req.params;
  const versions = query<DbMiscRecordVersion>(
    'SELECT * FROM misc_record_versions WHERE misc_record_id = ? ORDER BY version DESC',
    [recordId]
  );
  const formattedVersions = versions.map(formatMiscRecordVersion);
  res.json(formattedVersions);
}));

/**
 * 恢复版本
 */
router.post('/misc-records/:recordId/versions/:versionId/restore', asyncHandler(async (req: Request, res: Response) => {
  const { recordId, versionId } = req.params;

  const version = query<DbMiscRecordVersion>(
    'SELECT * FROM misc_record_versions WHERE id = ? AND misc_record_id = ?',
    [versionId, recordId]
  );

  if (version.length === 0) {
    res.status(404).json({ error: '版本未找到' });
    return;
  }

  // 获取当前记录状态
  const currentRecord = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [recordId]);

  // 检查当前状态与要恢复的版本是否不同
  const isDifferent =
    currentRecord[0].title !== version[0].title ||
    currentRecord[0].category !== version[0].category ||
    currentRecord[0].content !== version[0].content;

  // 如果当前状态与要恢复的版本不同，则创建当前状态的版本快照
  if (isDifferent) {
    const versionCount = (
      query('SELECT COUNT(*) as count FROM misc_record_versions WHERE misc_record_id = ?', [
        recordId
      ]) as { count: number }[]
    )[0].count;
    const newVersion = versionCount + 1;
    const newVersionId = generateId();

    run(
      'INSERT INTO misc_record_versions (id, misc_record_id, title, category, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        newVersionId,
        recordId,
        currentRecord[0].title,
        currentRecord[0].category ?? null,
        currentRecord[0].content ?? null,
        newVersion,
        now()
      ]
    );
  }

  // 恢复到指定版本
  run(
    'UPDATE misc_records SET title = ?, category = ?, content = ?, updated_at = ? WHERE id = ?',
    [
      version[0].title,
      version[0].category,
      version[0].content,
      now(),
      recordId
    ]
  );

  saveDB();

  const records = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [recordId]);
  res.json(formatMiscRecord(records[0]));
}));

export default router;
