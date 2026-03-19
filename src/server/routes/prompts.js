// Prompt Templates API 路由
const express = require('express');
const router = express.Router();
const { query, run, saveDB } = require('../db');
const { generateId, now } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取所有提示词模板
router.get('/', asyncHandler(async (req, res) => {
  const templates = query('SELECT * FROM prompt_templates ORDER BY created_at ASC');
  res.json(templates);
}));

// 创建提示词模板
router.post('/', asyncHandler(async (req, res) => {
  const { name, template, type } = req.body;
  const id = generateId();
  const createdAt = now();

  run('INSERT INTO prompt_templates (id, name, template, type, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, template, type, createdAt]);

  saveDB();

  const templates = query('SELECT * FROM prompt_templates WHERE id = ?', [id]);
  res.status(201).json(templates[0]);
}));

// 删除提示词模板
router.delete('/:id', asyncHandler(async (req, res) => {
  run('DELETE FROM prompt_templates WHERE id = ?', [req.params.id]);
  saveDB();
  res.status(204).send();
}));

module.exports = router;
