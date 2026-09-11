// Timeline API 路由（业务逻辑在 timelineService）
// 注意: 时间线节点的更新路由使用 /api/timeline/:id 而不是 /api/timeline/nodes/:id
// 这是为了保持与现有前端代码的兼容性,避免破坏性变更
import express, { Router, Request, Response } from 'express';
import * as timelineService from '../services/domain/timelineService';
import { asyncHandler } from '../middleware/errorHandler';

const router: Router = express.Router();

/**
 * 获取项目的时间线节点
 */
router.get('/projects/:projectId/timeline', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, content } = req.query as { title?: string; content?: string };
  res.json(timelineService.listTimelineEvents(projectId, { title, content }));
}));

/**
 * 创建时间线节点
 */
router.post('/projects/:projectId/timeline', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, date, content, orderIndex } = req.body;
  res.status(201).json(timelineService.createTimelineEvent(projectId, { title, date, content, orderIndex }));
}));

/**
 * 更新时间线节点（未提供的字段保持原值）
 */
router.put('/timeline/:id', asyncHandler(async (req: Request, res: Response) => {
  const { title, date, content, orderIndex, createVersion } = req.body;
  res.json(timelineService.updateTimelineEvent(req.params.id, { title, date, content, orderIndex }, { createVersion }));
}));

/**
 * 删除时间线节点（软删除）
 */
router.delete('/timeline/:id', asyncHandler(async (req: Request, res: Response) => {
  timelineService.archiveTimelineEvent(req.params.id);
  res.status(204).send();
}));

/**
 * 恢复时间线节点
 */
router.post('/timeline/:id/restore', asyncHandler(async (req: Request, res: Response) => {
  res.json(timelineService.restoreTimelineEvent(req.params.id));
}));

/**
 * 永久删除时间线节点
 */
router.delete('/timeline/:id/permanent', asyncHandler(async (req: Request, res: Response) => {
  timelineService.permanentDeleteTimelineEvent(req.params.id);
  res.status(204).send();
}));

/**
 * 获取项目的时间线节点回收站
 */
router.get('/projects/:projectId/timeline/trash', asyncHandler(async (req: Request, res: Response) => {
  res.json(timelineService.listTimelineTrash(req.params.projectId));
}));

/**
 * 获取单个时间线节点
 */
router.get('/timeline/:id', asyncHandler(async (req: Request, res: Response) => {
  res.json(timelineService.getTimelineEvent(req.params.id));
}));

/**
 * 获取版本历史
 */
router.get('/timeline/:nodeId/versions', asyncHandler(async (req: Request, res: Response) => {
  res.json(timelineService.listTimelineVersions(req.params.nodeId));
}));

/**
 * 恢复版本
 */
router.post('/timeline/:nodeId/versions/:versionId/restore', asyncHandler(async (req: Request, res: Response) => {
  res.json(timelineService.restoreTimelineVersion(req.params.nodeId, req.params.versionId));
}));

export default router;
