// Chats API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { formatChat } from '../utils/formatters';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbChat, Chat } from '@shared/types';

const router: Router = express.Router();

// 获取项目的所有聊天
router.get('/projects/:projectId/chats', asyncHandler(async (req: Request, res: Response) => {
  const chats = query<DbChat>('SELECT * FROM chats WHERE project_id = ? ORDER BY updated_at DESC', [req.params.projectId]);
  const formattedChats: Chat[] = chats.map(formatChat);
  res.json(formattedChats);
}));

// 获取单个聊天
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const chats = query<DbChat>('SELECT * FROM chats WHERE id = ?', [req.params.id]);
  if (chats.length === 0) {
    res.status(404).json({ error: '聊天未找到' });
    return;
  }
  res.json(formatChat(chats[0]));
}));

// 创建聊天
router.post('/projects/:projectId/chats', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  run('INSERT INTO chats (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, req.params.projectId, name, createdAt, updatedAt]);

  saveDB();

  const chats = query<DbChat>('SELECT * FROM chats WHERE id = ?', [id]);
  res.status(201).json(formatChat(chats[0]));
}));

// 更新聊天
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const updatedAt = now();

  run('UPDATE chats SET name = ?, updated_at = ? WHERE id = ?', [name, updatedAt, req.params.id]);

  saveDB();

  const chats = query<DbChat>('SELECT * FROM chats WHERE id = ?', [req.params.id]);
  res.json(formatChat(chats[0]));
}));

// 删除聊天
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  run('DELETE FROM chats WHERE id = ?', [req.params.id]);
  saveDB();
  res.status(204).send();
}));

export default router;
