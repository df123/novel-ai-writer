// Projects API 路由
const express = require('express');
const router = express.Router();
const { query, run, saveDB } = require('../db');
const { generateId, now } = require('../utils/helpers');
const { formatProject } = require('../utils/formatters');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取所有项目
router.get('/', asyncHandler(async (req, res) => {
  const projects = query('SELECT * FROM projects ORDER BY updated_at DESC');
  const formattedProjects = projects.map(formatProject);
  res.json(formattedProjects);
}));

// 获取单个项目
router.get('/:id', asyncHandler(async (req, res) => {
  const projects = query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (projects.length === 0) {
    return res.status(404).json({ error: '项目未找到' });
  }
  res.json(formatProject(projects[0]));
}));

// 创建项目
router.post('/', asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  run('INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, title, description || null, createdAt, updatedAt]);

  saveDB();

  const projects = query('SELECT * FROM projects WHERE id = ?', [id]);
  res.status(201).json(formatProject(projects[0]));
}));

// 更新项目
router.put('/:id', asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const updatedAt = now();

  run('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
    [title, description || null, updatedAt, req.params.id]);

  saveDB();

  const projects = query('SELECT * FROM projects WHERE id = ?', [id]);
  res.json(formatProject(projects[0]));
}));

// 删除项目
router.delete('/:id', asyncHandler(async (req, res) => {
  run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  saveDB();
  res.status(204).send();
}));

module.exports = router;
