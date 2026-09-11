// 角色领域服务：版本快照 + 软删除 + 回收站，REST 与 MCP 共用
import { query, run } from '../../db';
import { withWriteTransaction } from '../../db/transaction';
import { generateId, now } from '../../utils/helpers';
import { formatCharacter, formatCharacterVersion } from '../../utils/formatters';
import { notFound, assertUpdatedAtMatch } from './errors';
import type { DbCharacter, DbCharacterVersion, Character, CharacterVersion } from '@shared/types';

export interface Scope {
  projectId?: string;
}

/** 创建角色入参 */
export interface CharacterInput {
  name: string;
  personality?: string;
  background?: string;
  relationships?: string;
}

/** 读取原始角色记录（含已软删除），不存在抛 NOT_FOUND；scope 用于跨项目校验 */
function requireCharacter(id: string, scope?: Scope): DbCharacter {
  const characters = query<DbCharacter>('SELECT * FROM characters WHERE id = ?', [id]);
  if (characters.length === 0) {
    throw notFound('角色未找到');
  }
  if (scope?.projectId && characters[0].project_id !== scope.projectId) {
    throw notFound('角色未找到');
  }
  return characters[0];
}

/** 下一个版本号（与既有逻辑一致：COUNT + 1） */
function nextVersion(characterId: string): number {
  const rows = query<{ count: number }>(
    'SELECT COUNT(*) as count FROM character_versions WHERE character_id = ?',
    [characterId]
  );
  return rows[0].count + 1;
}

/** 将当前状态写入版本快照 */
function snapshotCharacter(character: DbCharacter): void {
  run(
    'INSERT INTO character_versions (id, character_id, name, personality, background, relationships, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      generateId(),
      character.id,
      character.name,
      character.personality ?? null,
      character.background ?? null,
      character.relationships ?? null,
      nextVersion(character.id),
      now()
    ]
  );
}

/** 列出项目角色（支持模糊过滤） */
export function listCharacters(
  projectId: string,
  filters?: { name?: string; personality?: string; background?: string }
): Character[] {
  let sql = 'SELECT * FROM characters WHERE project_id = ? AND deleted = 0';
  const params: (string | number)[] = [projectId];
  if (filters?.name) {
    sql += ' AND name LIKE ?';
    params.push(`%${filters.name}%`);
  }
  if (filters?.personality) {
    sql += ' AND personality LIKE ?';
    params.push(`%${filters.personality}%`);
  }
  if (filters?.background) {
    sql += ' AND background LIKE ?';
    params.push(`%${filters.background}%`);
  }
  sql += ' ORDER BY created_at ASC';
  return query<DbCharacter>(sql, params).map(formatCharacter);
}

/** 获取单个角色（未删除） */
export function getCharacter(id: string, scope?: Scope): Character {
  const character = requireCharacter(id, scope);
  if (character.deleted === 1) {
    throw notFound('角色未找到');
  }
  return formatCharacter(character);
}

/** 创建角色 */
export function createCharacter(projectId: string, input: CharacterInput): Character {
  const id = generateId();
  const ts = now();
  withWriteTransaction(() => {
    run(
      'INSERT INTO characters (id, project_id, name, personality, background, relationships, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, input.name, input.personality || null, input.background || null, input.relationships || null, ts, ts]
    );
  });
  return getCharacter(id);
}

/**
 * 更新角色（部分字段）
 * @param createVersion 是否先保存旧状态快照（REST 由调用方控制；MCP 恒为 true）
 * @param expectedUpdatedAt 乐观并发检查（可选，Unix 秒）
 */
export function updateCharacter(
  id: string,
  input: Partial<CharacterInput>,
  options?: { createVersion?: boolean; expectedUpdatedAt?: number },
  scope?: Scope
): Character {
  return withWriteTransaction(() => {
    const existing = requireCharacter(id, scope);
    assertUpdatedAtMatch(options?.expectedUpdatedAt, existing.updated_at, 'Character');

    if (options?.createVersion) {
      snapshotCharacter(existing);
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.personality !== undefined) {
      updates.push('personality = ?');
      values.push(input.personality);
    }
    if (input.background !== undefined) {
      updates.push('background = ?');
      values.push(input.background);
    }
    if (input.relationships !== undefined) {
      updates.push('relationships = ?');
      values.push(input.relationships);
    }
    if (updates.length === 0) {
      return formatCharacter(existing);
    }
    updates.push('updated_at = ?');
    values.push(now());
    values.push(id);
    run(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, values);
    return getCharacter(id);
  });
}

/** 软删除角色 */
export function archiveCharacter(id: string, scope?: Scope): void {
  withWriteTransaction(() => {
    requireCharacter(id, scope);
    run('UPDATE characters SET deleted = 1, deleted_at = ? WHERE id = ?', [now(), id]);
  });
}

/** 从回收站恢复角色 */
export function restoreCharacter(id: string): Character {
  return withWriteTransaction(() => {
    requireCharacter(id);
    run('UPDATE characters SET deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
    return getCharacter(id);
  });
}

/** 永久删除角色（仅限已软删除，供原 Web 管理界面使用，不暴露给 MCP） */
export function permanentDeleteCharacter(id: string): void {
  withWriteTransaction(() => {
    const existing = requireCharacter(id);
    if (existing.deleted === 0) {
      throw notFound('只能永久删除已软删除的角色');
    }
    run('DELETE FROM characters WHERE id = ?', [id]);
  });
}

/** 项目角色回收站 */
export function listCharacterTrash(projectId: string): Character[] {
  return query<DbCharacter>(
    'SELECT * FROM characters WHERE project_id = ? AND deleted = 1 ORDER BY deleted_at DESC',
    [projectId]
  ).map(formatCharacter);
}

/** 角色版本历史 */
export function listCharacterVersions(characterId: string): CharacterVersion[] {
  return query<DbCharacterVersion>(
    'SELECT * FROM character_versions WHERE character_id = ? ORDER BY version DESC',
    [characterId]
  ).map(formatCharacterVersion);
}

/** 恢复角色到指定版本（恢复前若当前状态不同则先快照当前状态） */
export function restoreCharacterVersion(characterId: string, versionId: string): Character {
  return withWriteTransaction(() => {
    const versions = query<DbCharacterVersion>(
      'SELECT * FROM character_versions WHERE id = ? AND character_id = ?',
      [versionId, characterId]
    );
    if (versions.length === 0) {
      throw notFound('版本未找到');
    }
    const version = versions[0];
    const current = requireCharacter(characterId);

    const isDifferent =
      current.name !== version.name ||
      current.personality !== version.personality ||
      current.background !== version.background ||
      current.relationships !== version.relationships;
    if (isDifferent) {
      snapshotCharacter(current);
    }

    run(
      'UPDATE characters SET name = ?, personality = ?, background = ?, relationships = ?, updated_at = ? WHERE id = ?',
      [version.name, version.personality, version.background, version.relationships, now(), characterId]
    );
    return getCharacter(characterId);
  });
}
