// 主旨 API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { formatTheme, formatThemeHistory } from '../utils/formatters';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbTheme, DbThemeHistory } from '@shared/types';

const router: Router = express.Router({ mergeParams: true });

/**
 * 创建主旨请求体接口
 */
interface CreateThemeRequestBody {
  title: string;
  content: string;
  created_by?: string;
}

/**
 * 更新主旨请求体接口
 */
interface UpdateThemeRequestBody {
  title?: string;
  content?: string;
  created_by?: string;
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
 * 获取项目的主旨（每个项目只有一个主旨）
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  const themes = query<DbTheme>(
    'SELECT * FROM themes WHERE project_id = ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 1',
    [projectId]
  );

  if (themes.length === 0) {
    res.status(404).json({ error: '未找到主旨' });
    return;
  }

  res.json(formatTheme(themes[0]));
}));

/**
 * 创建或更新项目主旨（每个项目只有一个主旨）
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, content, created_by } = req.body as CreateThemeRequestBody;

  // 验证项目是否存在
  if (!validateProjectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  // 验证必填字段
  if (!title || !content) {
    res.status(400).json({ error: '标题和内容为必填字段' });
    return;
  }

  // 验证 created_by 的值
  if (created_by !== undefined && created_by !== 'user' && created_by !== 'llm') {
    res.status(400).json({ error: 'created_by 必须为 user 或 llm' });
    return;
  }

  const createdBy = created_by || 'user'; // 默认由用户创建

  // 检查项目是否已有主旨
  const existingThemes = query<DbTheme>(
    'SELECT * FROM themes WHERE project_id = ? AND deleted = 0',
    [projectId]
  );

  if (existingThemes.length > 0) {
    // 已有主旨，更新现有主旨
    const existingTheme = existingThemes[0];
    const historyId = generateId();
    const historyCreatedAt = now();
    const newVersion = existingTheme.version + 1;

    // 创建历史记录
    run(
      'INSERT INTO theme_history (id, theme_id, content, version, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [historyId, existingTheme.id, existingTheme.content, existingTheme.version, existingTheme.created_by, historyCreatedAt]
    );

    // 更新主旨
    const updatedAt = now();
    run(
      'UPDATE themes SET title = ?, content = ?, version = ?, created_by = ?, updated_at = ? WHERE id = ?',
      [title, content, newVersion, createdBy, updatedAt, existingTheme.id]
    );

    saveDB();

    const updatedThemes = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [existingTheme.id]);
    res.json(formatTheme(updatedThemes[0]));
  } else {
    // 创建新主旨
    const id = generateId();
    const createdAt = now();
    const updatedAt = now();

    run(
      'INSERT INTO themes (id, project_id, title, content, version, created_by, deleted, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, 0, NULL, ?, ?)',
      [id, projectId, title, content, createdBy, createdAt, updatedAt]
    );

    saveDB();

    const themes = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);
    res.status(201).json(formatTheme(themes[0]));
  }
}));

/**
 * 获取单个主旨
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const themes = query<DbTheme>('SELECT * FROM themes WHERE id = ? AND deleted = 0', [id]);

  if (themes.length === 0) {
    res.status(404).json({ error: '主旨未找到' });
    return;
  }

  res.json(formatTheme(themes[0]));
}));

/**
 * 更新主旨（自动创建历史记录）
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content, created_by } = req.body as UpdateThemeRequestBody;

  // 获取现有主旨
  const existingThemes = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);

  if (existingThemes.length === 0) {
    res.status(404).json({ error: '主旨未找到' });
    return;
  }

  const existingTheme = existingThemes[0];

  // 检查是否提供了更新内容
  if (title === undefined && content === undefined && created_by === undefined) {
    res.status(400).json({ error: '没有提供任何更新内容' });
    return;
  }

  // 验证 created_by 的值
  if (created_by !== undefined && created_by !== 'user' && created_by !== 'llm') {
    res.status(400).json({ error: 'created_by 必须为 user 或 llm' });
    return;
  }

  // 创建历史记录
  const historyId = generateId();
  const historyCreatedAt = now();
  const newVersion = existingTheme.version + 1;

  run(
    'INSERT INTO theme_history (id, theme_id, content, version, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [historyId, id, existingTheme.content, existingTheme.version, existingTheme.created_by, historyCreatedAt]
  );

  // 更新主旨
  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }

  if (content !== undefined) {
    updates.push('content = ?');
    params.push(content);
  }

  // 更新版本号和更新时间
  updates.push('version = ?');
  params.push(newVersion);
  updates.push('updated_at = ?');
  params.push(now());

  // 如果提供了created_by，则更新它
  if (created_by !== undefined) {
    updates.push('created_by = ?');
    params.push(created_by);
  }

  params.push(id);

  run(`UPDATE themes SET ${updates.join(', ')} WHERE id = ?`, params);

  saveDB();

  const updatedThemes = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);
  res.json(formatTheme(updatedThemes[0]));
}));

/**
 * 删除主旨
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 检查主旨是否存在
  const themes = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);

  if (themes.length === 0) {
    res.status(404).json({ error: '主旨未找到' });
    return;
  }

  const deletedAt = now();
  run('UPDATE themes SET deleted = 1, deleted_at = ? WHERE id = ?', [deletedAt, id]);
  saveDB();
  res.status(204).send();
}));

/**
 * 获取主旨的历史记录
 */
router.get('/:id/history', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 检查主旨是否存在
  const themes = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);

  if (themes.length === 0) {
    res.status(404).json({ error: '主旨未找到' });
    return;
  }

  const history = query<DbThemeHistory>(
    'SELECT * FROM theme_history WHERE theme_id = ? ORDER BY version DESC',
    [id]
  );
  const formattedHistory = history.map(formatThemeHistory);
  res.json(formattedHistory);
}));

/**
 * 获取指定版本的历史记录
 */
router.get('/:id/history/:version', asyncHandler(async (req: Request, res: Response) => {
  const { id, version } = req.params;
  const versionNum = parseInt(version, 10);

  if (isNaN(versionNum)) {
    res.status(400).json({ error: '版本号格式错误' });
    return;
  }

  // 检查主旨是否存在
  const themes = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);

  if (themes.length === 0) {
    res.status(404).json({ error: '主旨未找到' });
    return;
  }

  const history = query<DbThemeHistory>(
    'SELECT * FROM theme_history WHERE theme_id = ? AND version = ?',
    [id, versionNum]
  );

  if (history.length === 0) {
    res.status(404).json({ error: '未找到指定版本的历史记录' });
    return;
  }

  res.json(formatThemeHistory(history[0]));
}));

export default router;
