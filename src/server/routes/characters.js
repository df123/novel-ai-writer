// Characters API 路由
// 注意: 角色的更新路由使用 /api/characters/:id,这是 RESTful 的标准设计
// 时间线节点的更新路由使用 /api/timeline/:id 是为了保持与现有前端代码的兼容性
const express = require('express');
const router = express.Router();
const { query, run, saveDB } = require('../db');
const { generateId, now } = require('../utils/helpers');
const { formatCharacter, formatCharacterVersion } = require('../utils/formatters');
const { logError } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取项目的所有角色
router.get('/projects/:projectId/characters', asyncHandler(async (req, res) => {
  const { name, description, personality, background } = req.query;
  let sql = 'SELECT * FROM characters WHERE project_id = ?';
  const params = [req.params.projectId];

  if (name) {
    sql += ' AND name LIKE ?';
    params.push(`%${name}%`);
  }

  if (description) {
    sql += ' AND description LIKE ?';
    params.push(`%${description}%`);
  }

  if (personality) {
    sql += ' AND personality LIKE ?';
    params.push(`%${personality}%`);
  }

  if (background) {
    sql += ' AND background LIKE ?';
    params.push(`%${background}%`);
  }

  sql += ' ORDER BY created_at ASC';

  const characters = query(sql, params);
  const formattedCharacters = characters.map(formatCharacter);
  res.json(formattedCharacters);
}));

// 创建角色
router.post('/projects/:projectId/characters', asyncHandler(async (req, res) => {
  const { name, description, personality, background, relationships, avatar } = req.body;
  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  run('INSERT INTO characters (id, project_id, name, description, personality, background, relationships, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.params.projectId, name, description || null, personality || null, background || null, relationships || null, avatar || null, createdAt, updatedAt]);

  saveDB();

  const characters = query('SELECT * FROM characters WHERE id = ?', [id]);
  res.status(201).json(formatCharacter(characters[0]));
}));

// 更新角色
router.put('/characters/:id', asyncHandler(async (req, res) => {
  const { name, description, personality, background, relationships, avatar, createVersion } = req.body;
  const updatedAt = now();

  // 检查角色是否存在
  const existingCharacters = query('SELECT * FROM characters WHERE id = ?', [req.params.id]);
  if (existingCharacters.length === 0) {
    return res.status(404).json({ error: '角色未找到' });
  }

  if (createVersion) {
    const existingCharacter = existingCharacters[0];
    const versionCount = query('SELECT COUNT(*) as count FROM character_versions WHERE character_id = ?', [req.params.id])[0].count;
    const newVersion = versionCount + 1;
    const versionId = generateId();

    run('INSERT INTO character_versions (id, character_id, name, description, personality, background, relationships, avatar_url, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [versionId, req.params.id, existingCharacter.name, existingCharacter.description ?? null, existingCharacter.personality ?? null, existingCharacter.background ?? null, existingCharacter.relationships ?? null, existingCharacter.avatar_url ?? null, newVersion, now()]);
  }

  // 构建动态 UPDATE 语句 - 只更新提供的字段
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (personality !== undefined) {
    updates.push('personality = ?');
    values.push(personality);
  }
  if (background !== undefined) {
    updates.push('background = ?');
    values.push(background);
  }
  if (relationships !== undefined) {
    updates.push('relationships = ?');
    values.push(relationships);
  }
  if (avatar !== undefined) {
    updates.push('avatar_url = ?');
    values.push(avatar);
  }

  // 检查是否有字段需要更新（不包括 updated_at）
  if (updates.length === 0) {
    // 没有字段需要更新，直接返回现有角色
    return res.json(formatCharacter(existingCharacters[0]));
  }

  // 始终更新 updated_at
  updates.push('updated_at = ?');
  values.push(updatedAt);

  // 添加 WHERE 子句参数
  values.push(req.params.id);

  const updateSQL = `UPDATE characters SET ${updates.join(', ')} WHERE id = ?`;
  run(updateSQL, values);

  saveDB();

  const characters = query('SELECT * FROM characters WHERE id = ?', [req.params.id]);
  res.json(formatCharacter(characters[0]));
}));

// 删除角色
router.delete('/characters/:id', asyncHandler(async (req, res) => {
  run('DELETE FROM characters WHERE id = ?', [req.params.id]);
  saveDB();
  res.status(204).send();
}));

// 获取单个角色
router.get('/characters/:id', asyncHandler(async (req, res) => {
  const characters = query('SELECT * FROM characters WHERE id = ?', [req.params.id]);
  if (characters.length === 0) {
    return res.status(404).json({ error: '角色未找到' });
  }
  res.json(formatCharacter(characters[0]));
}));

// 获取版本历史
router.get('/characters/:characterId/versions', asyncHandler(async (req, res) => {
  const versions = query('SELECT * FROM character_versions WHERE character_id = ? ORDER BY version DESC', [req.params.characterId]);
  const formattedVersions = versions.map(formatCharacterVersion);
  res.json(formattedVersions);
}));

// 恢复版本
router.post('/characters/:characterId/versions/:versionId/restore', asyncHandler(async (req, res) => {
  const version = query('SELECT * FROM character_versions WHERE id = ? AND character_id = ?', [req.params.versionId, req.params.characterId])[0];

  if (!version) {
    return res.status(404).json({ error: '版本未找到' });
  }

  run('UPDATE characters SET name = ?, description = ?, personality = ?, background = ?, relationships = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
    [version.name, version.description, version.personality, version.background, version.relationships, version.avatar_url, now(), req.params.characterId]);

  saveDB();

  const characters = query('SELECT * FROM characters WHERE id = ?', [req.params.characterId]);
  res.json(formatCharacter(characters[0]));
}));

module.exports = router;
