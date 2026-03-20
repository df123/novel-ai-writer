// Timeline API 路由
// 注意: 时间线节点的更新路由使用 /api/timeline/:id 而不是 /api/timeline/nodes/:id
// 这是为了保持与现有前端代码的兼容性,避免破坏性变更
const express = require('express');
const router = express.Router();
const { query, run, saveDB } = require('../db');
const { generateId, now, parseTimelineContent } = require('../utils/helpers');
const { formatTimelineNode, formatTimelineVersion } = require('../utils/formatters');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取项目的时间线节点
router.get('/projects/:projectId/timeline', asyncHandler(async (req, res) => {
  const { title, content } = req.query;
  let sql = 'SELECT * FROM timeline_nodes WHERE project_id = ?';
  const params = [req.params.projectId];

  if (title) {
    sql += ' AND title LIKE ?';
    params.push(`%${title}%`);
  }

  if (content) {
    sql += ' AND content LIKE ?';
    params.push(`%${content}%`);
  }

  sql += ' ORDER BY order_index ASC';

  const nodes = query(sql, params);
  const formattedNodes = nodes.map(n => formatTimelineNode(n, parseTimelineContent));
  res.json(formattedNodes);
}));

// 创建时间线节点
router.post('/projects/:projectId/timeline', asyncHandler(async (req, res) => {
  const { title, content, orderIndex } = req.body;
  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  run('INSERT INTO timeline_nodes (id, project_id, title, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, req.params.projectId, title, content || null, orderIndex || 0, createdAt, updatedAt]);

  saveDB();

  const nodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
  res.status(201).json(formatTimelineNode(nodes[0], parseTimelineContent));
}));

// 更新时间线节点
router.put('/timeline/:id', asyncHandler(async (req, res) => {
  const { title, content, orderIndex, createVersion } = req.body;
  const updatedAt = now();

  if (createVersion) {
    const existingNodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [req.params.id]);
    if (existingNodes.length > 0) {
      const existingNode = existingNodes[0];
      const versionCount = query('SELECT COUNT(*) as count FROM timeline_versions WHERE timeline_node_id = ?', [req.params.id])[0].count;
      const newVersion = versionCount + 1;
      const versionId = generateId();

      run('INSERT INTO timeline_versions (id, timeline_node_id, title, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [versionId, req.params.id, existingNode.title, existingNode.content ?? null, newVersion, now()]);
    }
  }

  run('UPDATE timeline_nodes SET title = ?, content = ?, order_index = ?, updated_at = ? WHERE id = ?',
    [title, content ?? null, orderIndex || 0, updatedAt, req.params.id]);

  saveDB();

  const nodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [req.params.id]);
  res.json(formatTimelineNode(nodes[0], parseTimelineContent));
}));

// 删除时间线节点
router.delete('/timeline/:id', asyncHandler(async (req, res) => {
  run('DELETE FROM timeline_nodes WHERE id = ?', [req.params.id]);
  saveDB();
  res.status(204).send();
}));

// 获取单个时间线节点
router.get('/timeline/:id', asyncHandler(async (req, res) => {
  const nodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [req.params.id]);
  if (nodes.length === 0) {
    return res.status(404).json({ error: '时间线节点未找到' });
  }
  res.json(formatTimelineNode(nodes[0], parseTimelineContent));
}));

// 获取版本历史
router.get('/timeline/:nodeId/versions', asyncHandler(async (req, res) => {
  const versions = query('SELECT * FROM timeline_versions WHERE timeline_node_id = ? ORDER BY version DESC', [req.params.nodeId]);
  const formattedVersions = versions.map(formatTimelineVersion);
  res.json(formattedVersions);
}));

// 恢复版本
router.post('/timeline/:nodeId/versions/:versionId/restore', asyncHandler(async (req, res) => {
  const version = query('SELECT * FROM timeline_versions WHERE id = ? AND timeline_node_id = ?', [req.params.versionId, req.params.nodeId])[0];

  if (!version) {
    return res.status(404).json({ error: '版本未找到' });
  }

  // 获取当前节点状态
  const currentNode = query('SELECT * FROM timeline_nodes WHERE id = ?', [req.params.nodeId])[0];

  // 检查当前状态与要恢复的版本是否不同
  const isDifferent = currentNode.title !== version.title || currentNode.content !== version.content;

  // 如果当前状态与要恢复的版本不同，则创建当前状态的版本快照
  if (isDifferent) {
    const versionCount = query('SELECT COUNT(*) as count FROM timeline_versions WHERE timeline_node_id = ?', [req.params.nodeId])[0].count;
    const newVersion = versionCount + 1;
    const versionId = generateId();

    run('INSERT INTO timeline_versions (id, timeline_node_id, title, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [versionId, req.params.nodeId, currentNode.title, currentNode.content ?? null, newVersion, now()]);
  }

  // 恢复到指定版本
  run('UPDATE timeline_nodes SET title = ?, content = ?, updated_at = ? WHERE id = ?',
    [version.title, version.content, now(), req.params.nodeId]);

  saveDB();

  const nodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [req.params.nodeId]);
  res.json(formatTimelineNode(nodes[0], parseTimelineContent));
}));

module.exports = router;
