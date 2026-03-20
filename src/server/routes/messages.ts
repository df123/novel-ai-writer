// Messages API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { parseToolCalls } from '../utils/formatters';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbMessage, ToolCall } from '@shared/types';

const router: Router = express.Router();

/**
 * 创建消息请求体接口
 */
interface CreateMessageRequestBody {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * 更新消息请求体接口
 */
interface UpdateMessageRequestBody {
  role?: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * 获取聊天的所有消息
 */
router.get('/chats/:chatId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const messages = query<DbMessage>('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chatId]);
  
  const messagesWithParsedCalls = messages.map((msg: DbMessage) => ({
    ...msg,
    tool_calls: parseToolCalls(msg.tool_calls)
  }));
  
  res.json(messagesWithParsedCalls);
}));

/**
 * 创建消息
 */
router.post('/chats/:chatId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { role, content, reasoning_content, tool_calls, tool_call_id } = req.body as CreateMessageRequestBody;
  
  const id = generateId();
  const timestamp = now();
  const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;

  run(
    'INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls, tool_call_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, chatId, role, content, reasoning_content || null, toolCallsJson, tool_call_id || null, timestamp]
  );

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [timestamp, chatId]);

  saveDB();

  const messages = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  const message = messages[0];
  const messageWithParsedCalls = {
    ...message,
    tool_calls: parseToolCalls(message.tool_calls)
  };
  
  res.status(201).json(messageWithParsedCalls);
}));

/**
 * 更新消息
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, content, reasoning_content, tool_calls, tool_call_id } = req.body as UpdateMessageRequestBody;

  const existing = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  if (existing.length === 0) {
    res.status(404).json({ error: '消息未找到' });
    return;
  }

  const existingMessage = existing[0];
  const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;
  
  run(
    'UPDATE messages SET role = ?, content = ?, reasoning_content = ?, tool_calls = ?, tool_call_id = ? WHERE id = ?',
    [role, content, reasoning_content || null, toolCallsJson, tool_call_id || null, id]
  );

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), existingMessage.chat_id]);

  saveDB();

  const messages = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  const message = messages[0];
  const messageWithParsedCalls = {
    ...message,
    tool_calls: parseToolCalls(message.tool_calls)
  };
  
  res.json(messageWithParsedCalls);
}));

/**
 * 删除消息
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const messages = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  
  run('DELETE FROM messages WHERE id = ?', [id]);

  if (messages.length > 0) {
    const message = messages[0];
    run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), message.chat_id]);
  }

  saveDB();
  res.status(204).send();
}));

export default router;
