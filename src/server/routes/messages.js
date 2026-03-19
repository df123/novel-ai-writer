// Messages API 路由
const express = require('express');
const router = express.Router();
const { query, run, saveDB } = require('../db');
const { generateId, now } = require('../utils/helpers');
const { formatMessage, parseToolCalls } = require('../utils/formatters');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取聊天的所有消息
router.get('/chats/:chatId/messages', asyncHandler(async (req, res) => {
  const messages = query('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [req.params.chatId]);
  messages.forEach(msg => {
    msg.tool_calls = parseToolCalls(msg.tool_calls);
  });
  res.json(messages);
}));

// 创建消息
router.post('/chats/:chatId/messages', asyncHandler(async (req, res) => {
  const { role, content, reasoning_content, tool_calls, tool_call_id } = req.body;
  const id = generateId();
  const timestamp = now();
  const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;

  run('INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls, tool_call_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.params.chatId, role, content, reasoning_content || null, toolCallsJson, tool_call_id || null, timestamp]);

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [timestamp, req.params.chatId]);

  saveDB();

  const messages = query('SELECT * FROM messages WHERE id = ?', [id]);
  messages[0].tool_calls = parseToolCalls(messages[0].tool_calls);
  res.status(201).json(messages[0]);
}));

// 更新消息
router.put('/:id', asyncHandler(async (req, res) => {
  const { role, content, reasoning_content, tool_calls, tool_call_id } = req.body;

  const existing = query('SELECT * FROM messages WHERE id = ?', [req.params.id]);
  if (existing.length === 0) {
    return res.status(404).json({ error: '消息未找到' });
  }

  const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;
  run('UPDATE messages SET role = ?, content = ?, reasoning_content = ?, tool_calls = ?, tool_call_id = ? WHERE id = ?',
    [role, content, reasoning_content || null, toolCallsJson, tool_call_id || null, req.params.id]);

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), existing[0].chat_id]);

  saveDB();

  const messages = query('SELECT * FROM messages WHERE id = ?', [req.params.id]);
  messages[0].tool_calls = parseToolCalls(messages[0].tool_calls);
  res.json(messages[0]);
}));

// 删除消息
router.delete('/:id', asyncHandler(async (req, res) => {
  const messages = query('SELECT * FROM messages WHERE id = ?', [req.params.id]);
  run('DELETE FROM messages WHERE id = ?', [req.params.id]);

  if (messages.length > 0) {
    run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), messages[0].chat_id]);
  }

  saveDB();
  res.status(204).send();
}));

module.exports = router;
