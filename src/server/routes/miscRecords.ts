// MiscRecords API 路由（业务逻辑在 worldEntryService，底层表 misc_records）
import express, { Router, Request, Response } from 'express';
import * as worldEntryService from '../services/domain/worldEntryService';
import { asyncHandler } from '../middleware/errorHandler';

const router: Router = express.Router();

/**
 * 获取项目的所有杂项记录
 */
router.get('/projects/:projectId/misc-records', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, search, category } = req.query as { title?: string; search?: string; category?: string };
  res.json(worldEntryService.listWorldEntries(projectId, { title, search, category }));
}));

/**
 * 创建杂项记录
 */
router.post('/projects/:projectId/misc-records', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, category, content } = req.body;
  res.status(201).json(worldEntryService.createWorldEntry(projectId, { title, category, content }));
}));

/**
 * 获取单个杂项记录
 */
router.get('/misc-records/:id', asyncHandler(async (req: Request, res: Response) => {
  res.json(worldEntryService.getWorldEntry(req.params.id));
}));

/**
 * 更新杂项记录
 */
router.put('/misc-records/:id', asyncHandler(async (req: Request, res: Response) => {
  const { title, category, content, createVersion } = req.body;
  res.json(worldEntryService.updateWorldEntry(req.params.id, { title, category, content }, { createVersion }));
}));

/**
 * 删除杂项记录（软删除）
 */
router.delete('/misc-records/:id', asyncHandler(async (req: Request, res: Response) => {
  worldEntryService.archiveWorldEntry(req.params.id);
  res.status(204).send();
}));

/**
 * 恢复杂项记录
 */
router.post('/misc-records/:id/restore', asyncHandler(async (req: Request, res: Response) => {
  res.json(worldEntryService.restoreWorldEntry(req.params.id));
}));

/**
 * 永久删除杂项记录
 */
router.delete('/misc-records/:id/permanent', asyncHandler(async (req: Request, res: Response) => {
  worldEntryService.permanentDeleteWorldEntry(req.params.id);
  res.status(204).send();
}));

/**
 * 获取项目的杂项记录回收站
 */
router.get('/projects/:projectId/misc-records/trash', asyncHandler(async (req: Request, res: Response) => {
  res.json(worldEntryService.listWorldEntryTrash(req.params.projectId));
}));

/**
 * 获取版本历史
 */
router.get('/misc-records/:recordId/versions', asyncHandler(async (req: Request, res: Response) => {
  res.json(worldEntryService.listWorldEntryVersions(req.params.recordId));
}));

/**
 * 恢复版本
 */
router.post('/misc-records/:recordId/versions/:versionId/restore', asyncHandler(async (req: Request, res: Response) => {
  res.json(worldEntryService.restoreWorldEntryVersion(req.params.recordId, req.params.versionId));
}));

export default router;
