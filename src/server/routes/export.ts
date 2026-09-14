// Export API 路由（public 模式加导出限流，设计书 §30）
import express, { Router, Request, Response, NextFunction } from 'express';
import { exportProject } from '../services/exportService';
import { asyncHandler } from '../middleware/errorHandler';
import { isPublicMode } from '../config';
import { rateLimitMiddleware } from '../web/webRateLimit';

const router: Router = express.Router();

// 仅挂在具体路由上：本路由挂载于 /api 通用前缀，router.use 会误伤其他未匹配路径
const exportLimiter: Array<(req: Request, res: Response, next: NextFunction) => void> =
  isPublicMode() ? [rateLimitMiddleware('export')] : [];

// 导出项目数据
router.post('/projects/:projectId/export', ...exportLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { format } = req.body;
  const result = exportProject(req.params.projectId, format);
  res.json(result);
}));

export default router;
