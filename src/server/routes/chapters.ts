// 章节 API 路由（业务逻辑在 chapterService，更新自动写入 chapter_versions 快照）
import express, { Router, Request, Response } from 'express';
import * as chapterService from '../services/domain/chapterService';
import { asyncHandler } from '../middleware/errorHandler';

const router: Router = express.Router({ mergeParams: true });

/**
 * 获取项目的章节列表
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  res.json(chapterService.listChapters(req.params.projectId));
}));

/**
 * 导出章节
 */
router.get('/export', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { format } = req.query;
  const exportFormat = format === 'md' ? 'md' : 'txt';
  const { exportChapters } = await import('../services/exportService');

  const chapters = chapterService.listChapters(projectId);
  if (chapters.length === 0) {
    res.status(404).json({ error: '没有可导出的章节' });
    return;
  }
  const result = exportChapters(chapters, exportFormat);
  res.setHeader('Content-Type', exportFormat === 'md' ? 'text/markdown' : 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.send(result.content);
}));

/**
 * 获取回收站章节
 */
router.get('/trash', asyncHandler(async (req: Request, res: Response) => {
  res.json(chapterService.listChapterTrash(req.params.projectId));
}));

/**
 * 批量更新章节排序
 */
router.put('/order', asyncHandler(async (req: Request, res: Response) => {
  const { chapters } = req.body;
  res.json(chapterService.updateChapterOrder(req.params.projectId, chapters));
}));

/**
 * 获取单个章节
 */
router.get('/:chapterId', asyncHandler(async (req: Request, res: Response) => {
  res.json(chapterService.getChapter(req.params.projectId, req.params.chapterId));
}));

/**
 * 创建章节
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { chapterNumber, title, content, sourceMessageId } = req.body;
  res.status(201).json(chapterService.createChapter(req.params.projectId, { chapterNumber, title, content, sourceMessageId }));
}));

/**
 * 更新章节
 */
router.put('/:chapterId', asyncHandler(async (req: Request, res: Response) => {
  const { title, chapterNumber, content } = req.body;
  res.json(chapterService.updateChapter(req.params.projectId, req.params.chapterId, { title, chapterNumber, content }));
}));

/**
 * 软删除章节
 */
router.delete('/:chapterId', asyncHandler(async (req: Request, res: Response) => {
  chapterService.archiveChapter(req.params.projectId, req.params.chapterId);
  res.status(204).send();
}));

/**
 * 恢复章节
 */
router.put('/:chapterId/restore', asyncHandler(async (req: Request, res: Response) => {
  res.json(chapterService.restoreChapter(req.params.projectId, req.params.chapterId));
}));

/**
 * 永久删除章节
 */
router.delete('/:chapterId/permanent', asyncHandler(async (req: Request, res: Response) => {
  chapterService.permanentDeleteChapter(req.params.projectId, req.params.chapterId);
  res.status(204).send();
}));

/**
 * 清空回收站
 */
router.delete('/trash/empty', asyncHandler(async (req: Request, res: Response) => {
  chapterService.emptyChapterTrash(req.params.projectId);
  res.status(204).send();
}));

export default router;
