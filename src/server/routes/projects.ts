// Projects API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { formatProject } from '../utils/formatters';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbProject, Project } from '@shared/types';

const router: Router = express.Router();

// 获取所有项目
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const projects = query<DbProject>('SELECT * FROM projects ORDER BY updated_at DESC');
  const formattedProjects: Project[] = projects.map(formatProject);
  res.json(formattedProjects);
}));

// 获取单个项目
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const projects = query<DbProject>('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (projects.length === 0) {
    res.status(404).json({ error: '项目未找到' });
    return;
  }
  res.json(formatProject(projects[0]));
}));

// 创建项目
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { title, description } = req.body;
  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  run('INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, title, description || null, createdAt, updatedAt]);

  saveDB();

  const projects = query<DbProject>('SELECT * FROM projects WHERE id = ?', [id]);
  res.status(201).json(formatProject(projects[0]));
}));

// 更新项目
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { title, description } = req.body;
  const updatedAt = now();

  run('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
    [title, description || null, updatedAt, req.params.id]);

  saveDB();

  const projects = query<DbProject>('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  res.json(formatProject(projects[0]));
}));

// 删除项目
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  saveDB();
  res.status(204).send();
}));

export default router;
