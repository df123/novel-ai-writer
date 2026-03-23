// Timeline API 路由
// 注意: 时间线节点的更新路由使用 /api/timeline/:id 而不是 /api/timeline/nodes/:id
// 这是为了保持与现有前端代码的兼容性,避免破坏性变更
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { formatTimelineNode, formatTimelineVersion } from '../utils/formatters';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbTimelineNode, DbTimelineVersion } from '@shared/types';

const router: Router = express.Router();

/**
 * 创建时间线节点请求体接口
 */
interface CreateTimelineNodeRequestBody {
  title: string;
  date?: string;
  content?: string;
  orderIndex?: number;
}

/**
 * 更新时间线节点请求体接口
 */
interface UpdateTimelineNodeRequestBody {
  title?: string;
  date?: string;
  content?: string;
  orderIndex?: number;
  createVersion?: boolean;
}

/**
 * 查询时间线节点参数接口
 */
interface GetTimelineNodesQuery {
  title?: string;
  content?: string;
}

/**
 * 获取项目的时间线节点
 */
router.get('/projects/:projectId/timeline', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, content } = req.query as GetTimelineNodesQuery;
  
  let sql = 'SELECT * FROM timeline_nodes WHERE project_id = ? AND deleted = 0';
  const params: (string | number)[] = [projectId];
  
  if (title) {
    sql += ' AND title LIKE ?';
    params.push(`%${title}%`);
  }

  if (content) {
    sql += ' AND content LIKE ?';
    params.push(`%${content}%`);
  }

  sql += ' ORDER BY order_index ASC';

  const nodes = query<DbTimelineNode>(sql, params);
  const formattedNodes = nodes.map(n => formatTimelineNode(n));
  res.json(formattedNodes);
}));

/**
 * 创建时间线节点
 */
router.post('/projects/:projectId/timeline', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, date, content, orderIndex } = req.body as CreateTimelineNodeRequestBody;
  
  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  run(
    'INSERT INTO timeline_nodes (id, project_id, title, date, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, title, date || null, content || null, orderIndex || 0, createdAt, updatedAt]
  );

  saveDB();

  const nodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
  res.status(201).json(formatTimelineNode(nodes[0]));
}));

/**
 * 更新时间线节点
 */
router.put('/timeline/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, date, content, orderIndex, createVersion } = req.body as UpdateTimelineNodeRequestBody;
  const updatedAt = now();

  if (createVersion) {
    const existingNodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
    if (existingNodes.length > 0) {
      const existingNode = existingNodes[0];
      const versionCount = (
        query('SELECT COUNT(*) as count FROM timeline_versions WHERE timeline_node_id = ?', [id]) as { count: number }[]
      )[0].count;
      const newVersion = versionCount + 1;
      const versionId = generateId();

      run(
        'INSERT INTO timeline_versions (id, timeline_node_id, title, date, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [versionId, id, existingNode.title, existingNode.date, existingNode.content ?? null, newVersion, now()]
      );
    }
  }

  run(
    'UPDATE timeline_nodes SET title = ?, date = ?, content = ?, order_index = ?, updated_at = ? WHERE id = ?',
    [title, date ?? null, content ?? null, orderIndex || 0, updatedAt, id]
  );

  saveDB();

  const nodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
  res.json(formatTimelineNode(nodes[0]));
}));

/**
 * 删除时间线节点（软删除）
 */
router.delete('/timeline/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedAt = now();
  run('UPDATE timeline_nodes SET deleted = 1, deleted_at = ? WHERE id = ?', [deletedAt, id]);
  saveDB();
  res.status(204).send();
}));

/**
 * 恢复时间线节点
 */
router.post('/timeline/:id/restore', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const nodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
  if (nodes.length === 0) {
    res.status(404).json({ error: '时间线节点未找到' });
    return;
  }
  run('UPDATE timeline_nodes SET deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
  saveDB();
  const restoredNodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
  res.json(formatTimelineNode(restoredNodes[0]));
}));

/**
 * 永久删除时间线节点
 */
router.delete('/timeline/:id/permanent', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const nodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
  if (nodes.length === 0) {
    res.status(404).json({ error: '时间线节点未找到' });
    return;
  }
  if (nodes[0].deleted === 0) {
    res.status(400).json({ error: '只能永久删除已软删除的时间线节点' });
    return;
  }
  run('DELETE FROM timeline_nodes WHERE id = ?', [id]);
  saveDB();
  res.status(204).send();
}));

/**
 * 获取项目的时间线节点回收站
 */
router.get('/projects/:projectId/timeline/trash', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const nodes = query<DbTimelineNode>(
    'SELECT * FROM timeline_nodes WHERE project_id = ? AND deleted = 1 ORDER BY deleted_at DESC',
    [projectId]
  );
  const formattedNodes = nodes.map(n => formatTimelineNode(n));
  res.json(formattedNodes);
}));

/**
 * 获取单个时间线节点
 */
router.get('/timeline/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const nodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ? AND deleted = 0', [id]);
  if (nodes.length === 0) {
    res.status(404).json({ error: '时间线节点未找到' });
    return;
  }
  res.json(formatTimelineNode(nodes[0]));
}));

/**
 * 获取版本历史
 */
router.get('/timeline/:nodeId/versions', asyncHandler(async (req: Request, res: Response) => {
  const { nodeId } = req.params;
  const versions = query<DbTimelineVersion>(
    'SELECT * FROM timeline_versions WHERE timeline_node_id = ? ORDER BY version DESC',
    [nodeId]
  );
  const formattedVersions = versions.map(formatTimelineVersion);
  res.json(formattedVersions);
}));

/**
 * 恢复版本
 */
router.post('/timeline/:nodeId/versions/:versionId/restore', asyncHandler(async (req: Request, res: Response) => {
  const { nodeId, versionId } = req.params;

  const version = query<DbTimelineVersion>(
    'SELECT * FROM timeline_versions WHERE id = ? AND timeline_node_id = ?',
    [versionId, nodeId]
  );

  if (version.length === 0) {
    res.status(404).json({ error: '版本未找到' });
    return;
  }

  // 获取当前节点状态
  const currentNode = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [nodeId]);

  // 检查当前状态与要恢复的版本是否不同
  const isDifferent =
    currentNode[0].title !== version[0].title ||
    currentNode[0].date !== version[0].date ||
    currentNode[0].content !== version[0].content;

  // 如果当前状态与要恢复的版本不同，则创建当前状态的版本快照
  if (isDifferent) {
    const versionCount = (
      query('SELECT COUNT(*) as count FROM timeline_versions WHERE timeline_node_id = ?', [nodeId]) as {
        count: number;
      }[]
    )[0].count;
    const newVersion = versionCount + 1;
    const newVersionId = generateId();

    run(
      'INSERT INTO timeline_versions (id, timeline_node_id, title, date, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newVersionId, nodeId, currentNode[0].title, currentNode[0].date, currentNode[0].content ?? null, newVersion, now()]
    );
  }

  // 恢复到指定版本
  run('UPDATE timeline_nodes SET title = ?, date = ?, content = ?, updated_at = ? WHERE id = ?', [
    version[0].title,
    version[0].date,
    version[0].content,
    now(),
    nodeId
  ]);

  saveDB();

  const nodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [nodeId]);
  res.json(formatTimelineNode(nodes[0]));
}));

export default router;
