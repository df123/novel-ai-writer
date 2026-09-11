// Characters API 路由（业务逻辑在 characterService）
// 注意: 角色的更新路由使用 /api/characters/:id,这是 RESTful 的标准设计
// 时间线节点的更新路由使用 /api/timeline/:id 是为了保持与现有前端代码的兼容性
import express, { Router, Request, Response } from 'express';
import * as characterService from '../services/domain/characterService';
import { asyncHandler } from '../middleware/errorHandler';

const router: Router = express.Router();

/**
 * 查询角色参数接口
 */
interface GetCharactersQuery {
  name?: string;
  personality?: string;
  background?: string;
}

/**
 * 获取项目的所有角色
 */
router.get('/projects/:projectId/characters', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { name, personality, background } = req.query as GetCharactersQuery;
  res.json(characterService.listCharacters(projectId, { name, personality, background }));
}));

/**
 * 创建角色
 */
router.post('/projects/:projectId/characters', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { name, personality, background, relationships } = req.body;
  res.status(201).json(characterService.createCharacter(projectId, { name, personality, background, relationships }));
}));

/**
 * 更新角色
 */
router.put('/characters/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name, personality, background, relationships, createVersion } = req.body;
  res.json(characterService.updateCharacter(req.params.id, { name, personality, background, relationships }, { createVersion }));
}));

/**
 * 删除角色（软删除）
 */
router.delete('/characters/:id', asyncHandler(async (req: Request, res: Response) => {
  characterService.archiveCharacter(req.params.id);
  res.status(204).send();
}));

/**
 * 恢复角色
 */
router.post('/characters/:id/restore', asyncHandler(async (req: Request, res: Response) => {
  res.json(characterService.restoreCharacter(req.params.id));
}));

/**
 * 永久删除角色
 */
router.delete('/characters/:id/permanent', asyncHandler(async (req: Request, res: Response) => {
  characterService.permanentDeleteCharacter(req.params.id);
  res.status(204).send();
}));

/**
 * 获取项目的角色回收站
 */
router.get('/projects/:projectId/characters/trash', asyncHandler(async (req: Request, res: Response) => {
  res.json(characterService.listCharacterTrash(req.params.projectId));
}));

/**
 * 获取单个角色
 */
router.get('/characters/:id', asyncHandler(async (req: Request, res: Response) => {
  res.json(characterService.getCharacter(req.params.id));
}));

/**
 * 获取版本历史
 */
router.get('/characters/:characterId/versions', asyncHandler(async (req: Request, res: Response) => {
  res.json(characterService.listCharacterVersions(req.params.characterId));
}));

/**
 * 恢复版本
 */
router.post('/characters/:characterId/versions/:versionId/restore', asyncHandler(async (req: Request, res: Response) => {
  res.json(characterService.restoreCharacterVersion(req.params.characterId, req.params.versionId));
}));

export default router;
