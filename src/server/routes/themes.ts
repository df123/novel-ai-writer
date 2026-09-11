// 主旨 API 路由（业务逻辑在 themeService）
import express, { Router, Request, Response } from 'express';
import * as themeService from '../services/domain/themeService';
import { asyncHandler } from '../middleware/errorHandler';

const router: Router = express.Router({ mergeParams: true });

/**
 * 获取项目的主旨（每个项目只有一个主旨）
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  res.json(themeService.getThemeByProject(projectId));
}));

/**
 * 创建或更新项目主旨（每个项目只有一个主旨）
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, content, created_by } = req.body;
  const existing = themeService.getThemeByProject(projectId);
  const theme = themeService.upsertTheme(projectId, { title, content, createdBy: created_by });
  res.status(existing ? 200 : 201).json(theme);
}));

/**
 * 获取单个主旨
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  res.json(themeService.getTheme(req.params.id));
}));

/**
 * 更新主旨（自动创建历史记录）
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { title, content, created_by } = req.body;
  res.json(themeService.updateTheme(req.params.id, { title, content, createdBy: created_by }));
}));

/**
 * 删除主旨
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  themeService.archiveTheme(req.params.id);
  res.status(204).send();
}));

/**
 * 获取主旨的历史记录
 */
router.get('/:id/history', asyncHandler(async (req: Request, res: Response) => {
  res.json(themeService.listThemeHistory(req.params.id));
}));

/**
 * 获取指定版本的历史记录
 */
router.get('/:id/history/:version', asyncHandler(async (req: Request, res: Response) => {
  const versionNum = parseInt(req.params.version, 10);
  if (isNaN(versionNum)) {
    res.status(400).json({ error: '版本号格式错误' });
    return;
  }
  res.json(themeService.getThemeHistoryVersion(req.params.id, versionNum));
}));

export default router;
