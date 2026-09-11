// Projects API 路由（业务逻辑在 projectService）
import express, { Router, Request, Response } from 'express';
import { run, saveDB } from '../db';
import * as projectService from '../services/domain/projectService';
import { asyncHandler } from '../middleware/errorHandler';
import type { Project } from '@shared/types';

const router: Router = express.Router();

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// 获取所有项目
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const projects: Project[] = projectService.listProjects();
  res.json(projects);
}));

// 获取单个项目（使用正则表达式限制 :id 只能是 UUID 格式）
router.get(`/:id(${UUID_PATTERN})`, asyncHandler(async (req: Request, res: Response) => {
  res.json(projectService.getProject(req.params.id));
}));

// 创建项目
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { title, description } = req.body;
  res.status(201).json(projectService.createProject({ title, description }));
}));

// 更新项目（使用正则表达式限制 :id 只能是 UUID 格式）
router.put(`/:id(${UUID_PATTERN})`, asyncHandler(async (req: Request, res: Response) => {
  const { title, description } = req.body;
  res.json(projectService.updateProject(req.params.id, { title, description }));
}));

// 删除项目（使用正则表达式限制 :id 只能是 UUID 格式）
router.delete(`/:id(${UUID_PATTERN})`, asyncHandler(async (req: Request, res: Response) => {
  run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  saveDB();
  res.status(204).send();
}));

export default router;
