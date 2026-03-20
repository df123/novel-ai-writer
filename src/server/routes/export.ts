// Export API 路由
import express, { Router, Request, Response } from 'express';
import { exportProject } from '../services/exportService';
import { asyncHandler } from '../middleware/errorHandler';

const router: Router = express.Router();

// 导出项目数据
router.post('/projects/:projectId/export', asyncHandler(async (req: Request, res: Response) => {
  const { format } = req.body;
  const result = exportProject(req.params.projectId, format);
  res.json(result);
}));

export default router;
