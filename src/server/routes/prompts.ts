// Prompt Templates API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbPromptTemplate } from '@shared/types';

const router: Router = express.Router();

// 获取所有提示词模板
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const templates = query<DbPromptTemplate>('SELECT * FROM prompt_templates ORDER BY created_at ASC');
  res.json(templates);
}));

// 创建提示词模板
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, template, type } = req.body;
  const id = generateId();
  const createdAt = now();

  run('INSERT INTO prompt_templates (id, name, template, type, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, template, type, createdAt]);

  saveDB();

  const templates = query<DbPromptTemplate>('SELECT * FROM prompt_templates WHERE id = ?', [id]);
  res.status(201).json(templates[0]);
}));

// 删除提示词模板
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  run('DELETE FROM prompt_templates WHERE id = ?', [req.params.id]);
  saveDB();
  res.status(204).send();
}));

export default router;
