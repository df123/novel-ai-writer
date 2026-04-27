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
 * 批量删除消息请求体接口
 */
interface BatchDeleteMessagesRequestBody {
  ids: string[];
}

/**
 * 获取聊天的所有消息
 */
router.get('/chats/:chatId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const messages = query<DbMessage>('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chatId]);
  
  const messagesWithParsedCalls = messages.map((msg: DbMessage) => ({
    ...msg,
    tool_calls: parseToolCalls(msg.tool_calls),
    reasoning_content: msg.reasoning_content,
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
    [id, chatId, role, content, reasoning_content ?? null, toolCallsJson, tool_call_id || null, timestamp]
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
router.put('/messages/:id', asyncHandler(async (req: Request, res: Response) => {
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
    [role, content, reasoning_content ?? null, toolCallsJson, tool_call_id || null, id]
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
router.delete('/messages/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log('[DELETE /messages/:id] 收到删除请求，消息ID:', id);
  
  const messages = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  console.log('[DELETE /messages/:id] 数据库查询结果，找到消息数量:', messages.length);
  
  if (messages.length === 0) {
    console.log('[DELETE /messages/:id] 错误：消息不存在，ID:', id);
    res.status(404).json({ error: '消息未找到' });
    return;
  }
  
  const message = messages[0];
  console.log('[DELETE /messages/:id] 找到消息:', { id: message.id, chatId: message.chat_id, role: message.role });
  
  run('DELETE FROM messages WHERE id = ?', [id]);
  console.log('[DELETE /messages/:id] 已执行删除操作');

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), message.chat_id]);
  console.log('[DELETE /messages/:id] 已更新聊天时间戳');

  saveDB();
  console.log('[DELETE /messages/:id] 数据库已保存');
  
  res.status(204).send();
  console.log('[DELETE /messages/:id] 返回 204 No Content');
}));

/**
 * 批量删除消息
 */
router.post('/messages/batch-delete', asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body as BatchDeleteMessagesRequestBody;
  console.log('[POST /messages/batch-delete] 收到批量删除请求，消息ID数量:', ids.length);

  if (!ids || ids.length === 0) {
    res.status(400).json({ error: '消息ID列表不能为空' });
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  const messages = query<DbMessage>(`SELECT * FROM messages WHERE id IN (${placeholders})`, ids);

  if (messages.length === 0) {
    res.status(404).json({ error: '未找到任何消息' });
    return;
  }

  run(`DELETE FROM messages WHERE id IN (${placeholders})`, ids);
  console.log('[POST /messages/batch-delete] 已执行批量删除操作');

  const chatId = messages[0].chat_id;
  run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), chatId]);
  console.log('[POST /messages/batch-delete] 已更新聊天时间戳');

  saveDB();
  console.log('[POST /messages/batch-delete] 数据库已保存');

  res.status(204).send();
  console.log('[POST /messages/batch-delete] 返回 204 No Content');
}));

export default router;
