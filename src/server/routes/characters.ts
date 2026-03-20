// Characters API 路由
// 注意: 角色的更新路由使用 /api/characters/:id,这是 RESTful 的标准设计
// 时间线节点的更新路由使用 /api/timeline/:id 是为了保持与现有前端代码的兼容性
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { generateId, now } from '../utils/helpers';
import { formatCharacter, formatCharacterVersion } from '../utils/formatters';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbCharacter, DbCharacterVersion } from '@shared/types';

const router: Router = express.Router();

/**
 * 创建角色请求体接口
 */
interface CreateCharacterRequestBody {
  name: string;
  description?: string;
  personality?: string;
  background?: string;
  relationships?: string;
}

/**
 * 更新角色请求体接口
 */
interface UpdateCharacterRequestBody {
  name?: string;
  description?: string;
  personality?: string;
  background?: string;
  relationships?: string;
  createVersion?: boolean;
}

/**
 * 查询角色参数接口
 */
interface GetCharactersQuery {
  name?: string;
  description?: string;
  personality?: string;
  background?: string;
}

/**
 * 获取项目的所有角色
 */
router.get('/projects/:projectId/characters', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { name, description, personality, background } = req.query as GetCharactersQuery;

  let sql = 'SELECT * FROM characters WHERE project_id = ?';
  const params: (string | number)[] = [projectId];

  if (name) {
    sql += ' AND name LIKE ?';
    params.push(`%${name}%`);
  }

  if (description) {
    sql += ' AND description LIKE ?';
    params.push(`%${description}%`);
  }

  if (personality) {
    sql += ' AND personality LIKE ?';
    params.push(`%${personality}%`);
  }

  if (background) {
    sql += ' AND background LIKE ?';
    params.push(`%${background}%`);
  }

  sql += ' ORDER BY created_at ASC';

  const characters = query<DbCharacter>(sql, params);
  const formattedCharacters = characters.map(formatCharacter);
  res.json(formattedCharacters);
}));

/**
 * 创建角色
 */
router.post('/projects/:projectId/characters', asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { name, description, personality, background, relationships } =
    req.body as CreateCharacterRequestBody;

  const id = generateId();
  const createdAt = now();
  const updatedAt = now();

  run(
    'INSERT INTO characters (id, project_id, name, description, personality, background, relationships, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      projectId,
      name,
      description || null,
      personality || null,
      background || null,
      relationships || null,
      createdAt,
      updatedAt
    ]
  );

  saveDB();

  const characters = query<DbCharacter>('SELECT * FROM characters WHERE id = ?', [id]);
  res.status(201).json(formatCharacter(characters[0]));
}));

/**
 * 更新角色
 */
router.put('/characters/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, personality, background, relationships, createVersion } =
    req.body as UpdateCharacterRequestBody;
  const updatedAt = now();

  // 检查角色是否存在
  const existingCharacters = query<DbCharacter>('SELECT * FROM characters WHERE id = ?', [id]);
  if (existingCharacters.length === 0) {
    res.status(404).json({ error: '角色未找到' });
    return;
  }

  if (createVersion) {
    const existingCharacter = existingCharacters[0];
    const versionCount = (
      query('SELECT COUNT(*) as count FROM character_versions WHERE character_id = ?', [id]) as {
        count: number;
      }[]
    )[0].count;
    const newVersion = versionCount + 1;
    const versionId = generateId();

    run(
      'INSERT INTO character_versions (id, character_id, name, description, personality, background, relationships, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        versionId,
        id,
        existingCharacter.name,
        existingCharacter.description ?? null,
        existingCharacter.personality ?? null,
        existingCharacter.background ?? null,
        existingCharacter.relationships ?? null,
        newVersion,
        now()
      ]
    );
  }

  // 构建动态 UPDATE 语句 - 只更新提供的字段
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (personality !== undefined) {
    updates.push('personality = ?');
    values.push(personality);
  }
  if (background !== undefined) {
    updates.push('background = ?');
    values.push(background);
  }
  if (relationships !== undefined) {
    updates.push('relationships = ?');
    values.push(relationships);
  }

  // 检查是否有字段需要更新（不包括 updated_at）
  if (updates.length === 0) {
    // 没有字段需要更新，直接返回现有角色
    res.json(formatCharacter(existingCharacters[0]));
    return;
  }

  // 始终更新 updated_at
  updates.push('updated_at = ?');
  values.push(updatedAt);

  // 添加 WHERE 子句参数
  values.push(id);

  const updateSQL = `UPDATE characters SET ${updates.join(', ')} WHERE id = ?`;
  run(updateSQL, values);

  saveDB();

  const characters = query<DbCharacter>('SELECT * FROM characters WHERE id = ?', [id]);
  res.json(formatCharacter(characters[0]));
}));

/**
 * 删除角色
 */
router.delete('/characters/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  run('DELETE FROM characters WHERE id = ?', [id]);
  saveDB();
  res.status(204).send();
}));

/**
 * 获取单个角色
 */
router.get('/characters/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const characters = query<DbCharacter>('SELECT * FROM characters WHERE id = ?', [id]);
  if (characters.length === 0) {
    res.status(404).json({ error: '角色未找到' });
    return;
  }
  res.json(formatCharacter(characters[0]));
}));

/**
 * 获取版本历史
 */
router.get('/characters/:characterId/versions', asyncHandler(async (req: Request, res: Response) => {
  const { characterId } = req.params;
  const versions = query<DbCharacterVersion>(
    'SELECT * FROM character_versions WHERE character_id = ? ORDER BY version DESC',
    [characterId]
  );
  const formattedVersions = versions.map(formatCharacterVersion);
  res.json(formattedVersions);
}));

/**
 * 恢复版本
 */
router.post('/characters/:characterId/versions/:versionId/restore', asyncHandler(async (req: Request, res: Response) => {
  const { characterId, versionId } = req.params;
  
  const version = query<DbCharacterVersion>(
    'SELECT * FROM character_versions WHERE id = ? AND character_id = ?',
    [versionId, characterId]
  );

  if (version.length === 0) {
    res.status(404).json({ error: '版本未找到' });
    return;
  }

  // 获取当前角色状态
  const currentCharacter = query<DbCharacter>('SELECT * FROM characters WHERE id = ?', [characterId]);

  // 检查当前状态与要恢复的版本是否不同
  const isDifferent =
    currentCharacter[0].name !== version[0].name ||
    currentCharacter[0].description !== version[0].description ||
    currentCharacter[0].personality !== version[0].personality ||
    currentCharacter[0].background !== version[0].background ||
    currentCharacter[0].relationships !== version[0].relationships;

  // 如果当前状态与要恢复的版本不同，则创建当前状态的版本快照
  if (isDifferent) {
    const versionCount = (
      query('SELECT COUNT(*) as count FROM character_versions WHERE character_id = ?', [
        characterId
      ]) as { count: number }[]
    )[0].count;
    const newVersion = versionCount + 1;
    const newVersionId = generateId();

    run(
      'INSERT INTO character_versions (id, character_id, name, description, personality, background, relationships, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newVersionId,
        characterId,
        currentCharacter[0].name,
        currentCharacter[0].description ?? null,
        currentCharacter[0].personality ?? null,
        currentCharacter[0].background ?? null,
        currentCharacter[0].relationships ?? null,
        newVersion,
        now()
      ]
    );
  }

  // 恢复到指定版本
  run(
    'UPDATE characters SET name = ?, description = ?, personality = ?, background = ?, relationships = ?, updated_at = ? WHERE id = ?',
    [
      version[0].name,
      version[0].description,
      version[0].personality,
      version[0].background,
      version[0].relationships,
      now(),
      characterId
    ]
  );

  saveDB();

  const characters = query<DbCharacter>('SELECT * FROM characters WHERE id = ?', [characterId]);
  res.json(formatCharacter(characters[0]));
}));

export default router;
