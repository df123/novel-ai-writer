// 章节 API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { formatChapter } from '../utils/formatters';
import { asyncHandler } from '../middleware/errorHandler';
import { exportChapters as exportChaptersService } from '../services/exportService';
import type { DbChapter, Chapter } from '@shared/types';

const router: Router = express.Router();

/**
 * 创建章节请求体接口
 */
interface CreateChapterRequestBody {
  chapterNumber: number;
  title: string;
  content: string;
  sourceMessageId?: string;
}

/**
 * 更新章节请求体接口
 */
interface UpdateChapterRequestBody {
  title?: string;
  chapterNumber?: number;
}

/**
 * 批量更新章节排序请求体接口
 */
interface UpdateChapterOrderRequestBody {
  chapters: Array<{
    id: string;
    chapterNumber: number;
  }>;
}

/**
 * 验证项目是否存在
 * @param projectId - 项目 ID
 * @returns 项目是否存在
 */
function validateProjectExists(projectId: string): boolean {
  const projects = query('SELECT * FROM projects WHERE id = ?', [projectId]);
  return projects.length > 0;
}

/**
 * 获取项目的章节列表
 */
router.get('/projects/:projectId/chapters', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE project_id = ? AND deleted = 0 ORDER BY chapter_number ASC',
    [projectId]
  );
  const formattedChapters = chapters.map(formatChapter);
  res.json(formattedChapters);
}));

/**
 * 获取单个章节
 */
router.get('/projects/:projectId/chapters/:chapterId', asyncHandler(async (req: Request, res: Response) => {
  const { projectId, chapterId } = req.params;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE id = ? AND project_id = ? AND deleted = 0',
    [chapterId, projectId]
  );

  if (chapters.length === 0) {
    res.status(404).json({ error: '章节未找到' });
    return;
  }

  res.json(formatChapter(chapters[0]));
}));

/**
 * 创建章节
 */
router.post('/projects/:projectId/chapters', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { chapterNumber, title, content, sourceMessageId } = req.body as CreateChapterRequestBody;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  // 验证必填字段
  if (!chapterNumber || !title || !content) {
    res.status(400).json({ error: '章节编号、标题和内容为必填字段' });
    return;
  }

  // 检查章节编号是否已存在
  const existingChapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE project_id = ? AND chapter_number = ? AND deleted = 0',
    [projectId, chapterNumber]
  );

  if (existingChapters.length > 0) {
    res.status(400).json({ error: '章节编号已存在' });
    return;
  }

  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  run(
    'INSERT INTO chapters (id, project_id, chapter_number, title, content, source_message_id, deleted, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)',
    [id, projectId, chapterNumber, title, content, sourceMessageId || null, createdAt, updatedAt]
  );

  saveDB();

  const chapters = query<DbChapter>('SELECT * FROM chapters WHERE id = ?', [id]);
  res.status(201).json(formatChapter(chapters[0]));
}));

/**
 * 更新章节（仅标题和编号）
 */
router.put('/projects/:projectId/chapters/:chapterId', asyncHandler(async (req: Request, res: Response) => {
  const { projectId, chapterId } = req.params;
  const { title, chapterNumber } = req.body as UpdateChapterRequestBody;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  // 获取现有章节
  const existingChapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE id = ? AND project_id = ?',
    [chapterId, projectId]
  );

  if (existingChapters.length === 0) {
    res.status(404).json({ error: '章节未找到' });
    return;
  }

  const existingChapter = existingChapters[0];
  const updates: string[] = [];
  const params: (string | number)[] = [];

  // 更新标题
  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }

  // 更新章节编号
  if (chapterNumber !== undefined) {
    // 检查新编号是否已被其他章节使用
    const duplicateChapters = query<DbChapter>(
      'SELECT * FROM chapters WHERE project_id = ? AND chapter_number = ? AND id != ? AND deleted = 0',
      [projectId, chapterNumber, chapterId]
    );

    if (duplicateChapters.length > 0) {
      res.status(400).json({ error: '章节编号已存在' });
      return;
    }

    updates.push('chapter_number = ?');
    params.push(chapterNumber);
  }

  // 如果没有更新内容，返回错误
  if (updates.length === 0) {
    res.status(400).json({ error: '没有提供任何更新内容' });
    return;
  }

  // 添加更新时间和章节ID
  updates.push('updated_at = ?');
  params.push(now());
  params.push(chapterId);

  run(`UPDATE chapters SET ${updates.join(', ')} WHERE id = ?`, params);
  saveDB();

  const updatedChapters = query<DbChapter>('SELECT * FROM chapters WHERE id = ?', [chapterId]);
  res.json(formatChapter(updatedChapters[0]));
}));

/**
 * 软删除章节
 */
router.delete('/projects/:projectId/chapters/:chapterId', asyncHandler(async (req: Request, res: Response) => {
  const { projectId, chapterId } = req.params;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  // 检查章节是否存在
  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE id = ? AND project_id = ?',
    [chapterId, projectId]
  );

  if (chapters.length === 0) {
    res.status(404).json({ error: '章节未找到' });
    return;
  }

  const deletedAt = now();
  run('UPDATE chapters SET deleted = 1, deleted_at = ? WHERE id = ?', [deletedAt, chapterId]);
  saveDB();
  res.status(204).send();
}));

/**
 * 恢复章节
 */
router.put('/projects/:projectId/chapters/:chapterId/restore', asyncHandler(async (req: Request, res: Response) => {
  const { projectId, chapterId } = req.params;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  // 检查章节是否存在
  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE id = ? AND project_id = ?',
    [chapterId, projectId]
  );

  if (chapters.length === 0) {
    res.status(404).json({ error: '章节未找到' });
    return;
  }

  run('UPDATE chapters SET deleted = 0, deleted_at = NULL WHERE id = ?', [chapterId]);
  saveDB();

  const restoredChapters = query<DbChapter>('SELECT * FROM chapters WHERE id = ?', [chapterId]);
  res.json(formatChapter(restoredChapters[0]));
}));

/**
 * 永久删除章节
 */
router.delete('/projects/:projectId/chapters/:chapterId/permanent', asyncHandler(async (req: Request, res: Response) => {
  const { projectId, chapterId } = req.params;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  // 检查章节是否存在
  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE id = ? AND project_id = ?',
    [chapterId, projectId]
  );

  if (chapters.length === 0) {
    res.status(404).json({ error: '章节未找到' });
    return;
  }

  // 检查章节是否已软删除
  if (chapters[0].deleted === 0) {
    res.status(400).json({ error: '只能永久删除已软删除的章节' });
    return;
  }

  run('DELETE FROM chapters WHERE id = ?', [chapterId]);
  saveDB();
  res.status(204).send();
}));

/**
 * 批量更新章节排序
 */
router.put('/projects/:projectId/chapters/order', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { chapters: chaptersData } = req.body as UpdateChapterOrderRequestBody;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  // 验证请求数据
  if (!Array.isArray(chaptersData) || chaptersData.length === 0) {
    res.status(400).json({ error: '请提供章节列表' });
    return;
  }

  // 验证每个章节数据
  for (const chapter of chaptersData) {
    if (!chapter.id || typeof chapter.chapterNumber !== 'number') {
      res.status(400).json({ error: '章节数据格式错误' });
      return;
    }
  }

  // 检查章节编号是否重复
  const chapterNumbers = chaptersData.map(c => c.chapterNumber);
  const uniqueNumbers = new Set(chapterNumbers);
  if (chapterNumbers.length !== uniqueNumbers.size) {
    res.status(400).json({ error: '章节编号不能重复' });
    return;
  }

  // 批量更新章节编号
  const updatedAt = now();
  for (const chapter of chaptersData) {
    run(
      'UPDATE chapters SET chapter_number = ?, updated_at = ? WHERE id = ? AND project_id = ?',
      [chapter.chapterNumber, updatedAt, chapter.id, projectId]
    );
  }

  saveDB();

  // 返回更新后的章节列表
  const updatedChapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE project_id = ? AND deleted = 0 ORDER BY chapter_number ASC',
    [projectId]
  );
  res.json(updatedChapters.map(formatChapter));
}));

/**
 * 导出章节
 */
router.get('/projects/:projectId/chapters/export', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { format } = req.query;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  // 验证导出格式
  const exportFormat = format === 'md' ? 'md' : 'txt';

  // 获取所有未删除的章节
  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE project_id = ? AND deleted = 0 ORDER BY chapter_number ASC',
    [projectId]
  );

  if (chapters.length === 0) {
    res.status(404).json({ error: '没有可导出的章节' });
    return;
  }

  // 格式化章节数据
  const formattedChapters: Chapter[] = chapters.map(formatChapter);

  // 导出章节
  const result = exportChaptersService(formattedChapters, exportFormat);

  // 设置响应头
  res.setHeader('Content-Type', exportFormat === 'md' ? 'text/markdown' : 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.send(result.content);
}));

/**
 * 获取回收站章节
 */
router.get('/projects/:projectId/chapters/trash', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE project_id = ? AND deleted = 1 ORDER BY deleted_at DESC',
    [projectId]
  );
  const formattedChapters = chapters.map(formatChapter);
  res.json(formattedChapters);
}));

/**
 * 清空回收站
 */
router.delete('/projects/:projectId/chapters/trash/empty', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  run('DELETE FROM chapters WHERE project_id = ? AND deleted = 1', [projectId]);
  saveDB();
  res.status(204).send();
}));

export default router;
