// 世界观条目领域服务：底层对应 misc_records 表，MCP 对外统一叫 world_entry
import { query, run } from '../../db';
import { withWriteTransaction } from '../../db/transaction';
import { generateId, now } from '../../utils/helpers';
import { formatMiscRecord, formatMiscRecordVersion } from '../../utils/formatters';
import { notFound, assertUpdatedAtMatch } from './errors';
import type { DbMiscRecord, DbMiscRecordVersion, MiscRecord, MiscRecordVersion } from '@shared/types';

export interface Scope {
  projectId?: string;
}

/** 创建世界观条目入参 */
export interface WorldEntryInput {
  title: string;
  category?: string;
  content?: string;
}

/** 读取原始记录（含已软删除），不存在抛 NOT_FOUND */
function requireWorldEntry(id: string, scope?: Scope): DbMiscRecord {
  const records = query<DbMiscRecord>('SELECT * FROM misc_records WHERE id = ?', [id]);
  if (records.length === 0) {
    throw notFound('世界观条目未找到');
  }
  if (scope?.projectId && records[0].project_id !== scope.projectId) {
    throw notFound('世界观条目未找到');
  }
  return records[0];
}

function nextVersion(recordId: string): number {
  const rows = query<{ count: number }>(
    'SELECT COUNT(*) as count FROM misc_record_versions WHERE misc_record_id = ?',
    [recordId]
  );
  return rows[0].count + 1;
}

function snapshotWorldEntry(record: DbMiscRecord): void {
  run(
    'INSERT INTO misc_record_versions (id, misc_record_id, title, category, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), record.id, record.title, record.category ?? null, record.content ?? null, nextVersion(record.id), now()]
  );
}

/** 列出项目世界观条目（支持过滤） */
export function listWorldEntries(
  projectId: string,
  filters?: { title?: string; search?: string; category?: string }
): MiscRecord[] {
  let sql = 'SELECT * FROM misc_records WHERE project_id = ? AND deleted = 0';
  const params: (string | number)[] = [projectId];
  if (filters?.title) {
    sql += ' AND title LIKE ?';
    params.push(`%${filters.title}%`);
  }
  if (filters?.search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters?.category) {
    sql += ' AND category = ?';
    params.push(filters.category);
  }
  sql += ' ORDER BY order_index ASC';
  return query<DbMiscRecord>(sql, params).map(formatMiscRecord);
}

/** 获取单个世界观条目（未删除） */
export function getWorldEntry(id: string, scope?: Scope): MiscRecord {
  const record = requireWorldEntry(id, scope);
  if (record.deleted === 1) {
    throw notFound('世界观条目未找到');
  }
  return formatMiscRecord(record);
}

/** 创建世界观条目（order_index 自动追加到末尾） */
export function createWorldEntry(projectId: string, input: WorldEntryInput): MiscRecord {
  const id = generateId();
  const ts = now();
  withWriteTransaction(() => {
    const maxOrder = query<{ maxOrder: number | null }>(
      'SELECT MAX(order_index) as maxOrder FROM misc_records WHERE project_id = ?',
      [projectId]
    );
    const orderIndex = (maxOrder[0]?.maxOrder ?? -1) + 1;
    run(
      'INSERT INTO misc_records (id, project_id, title, category, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, input.title, input.category ?? null, input.content ?? null, orderIndex, ts, ts]
    );
  });
  return getWorldEntry(id);
}

/**
 * 更新世界观条目（部分字段）
 * @param createVersion 是否先保存旧状态快照
 * @param expectedUpdatedAt 乐观并发检查（可选，Unix 秒）
 */
export function updateWorldEntry(
  id: string,
  input: Partial<WorldEntryInput>,
  options?: { createVersion?: boolean; expectedUpdatedAt?: number },
  scope?: Scope
): MiscRecord {
  return withWriteTransaction(() => {
    const existing = requireWorldEntry(id, scope);
    assertUpdatedAtMatch(options?.expectedUpdatedAt, existing.updated_at, 'World entry');

    if (options?.createVersion) {
      snapshotWorldEntry(existing);
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.category !== undefined) {
      updates.push('category = ?');
      values.push(input.category);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(input.content);
    }
    if (updates.length === 0) {
      return formatMiscRecord(existing);
    }
    updates.push('updated_at = ?');
    values.push(now());
    values.push(id);
    run(`UPDATE misc_records SET ${updates.join(', ')} WHERE id = ?`, values);
    return getWorldEntry(id);
  });
}

/** 软删除世界观条目 */
export function archiveWorldEntry(id: string, scope?: Scope): void {
  withWriteTransaction(() => {
    requireWorldEntry(id, scope);
    run('UPDATE misc_records SET deleted = 1, deleted_at = ? WHERE id = ?', [now(), id]);
  });
}

/** 从回收站恢复世界观条目 */
export function restoreWorldEntry(id: string): MiscRecord {
  return withWriteTransaction(() => {
    requireWorldEntry(id);
    run('UPDATE misc_records SET deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
    return getWorldEntry(id);
  });
}

/** 永久删除世界观条目（仅限已软删除，供原 Web 管理界面使用，不暴露给 MCP） */
export function permanentDeleteWorldEntry(id: string): void {
  withWriteTransaction(() => {
    const existing = requireWorldEntry(id);
    if (existing.deleted === 0) {
      throw notFound('只能永久删除已软删除的世界观条目');
    }
    run('DELETE FROM misc_records WHERE id = ?', [id]);
  });
}

/** 项目世界观条目回收站 */
export function listWorldEntryTrash(projectId: string): MiscRecord[] {
  return query<DbMiscRecord>(
    'SELECT * FROM misc_records WHERE project_id = ? AND deleted = 1 ORDER BY deleted_at DESC',
    [projectId]
  ).map(formatMiscRecord);
}

/** 世界观条目版本历史 */
export function listWorldEntryVersions(recordId: string): MiscRecordVersion[] {
  return query<DbMiscRecordVersion>(
    'SELECT * FROM misc_record_versions WHERE misc_record_id = ? ORDER BY version DESC',
    [recordId]
  ).map(formatMiscRecordVersion);
}

/** 恢复世界观条目到指定版本 */
export function restoreWorldEntryVersion(recordId: string, versionId: string): MiscRecord {
  return withWriteTransaction(() => {
    const versions = query<DbMiscRecordVersion>(
      'SELECT * FROM misc_record_versions WHERE id = ? AND misc_record_id = ?',
      [versionId, recordId]
    );
    if (versions.length === 0) {
      throw notFound('版本未找到');
    }
    const version = versions[0];
    const current = requireWorldEntry(recordId);

    const isDifferent =
      current.title !== version.title ||
      current.category !== version.category ||
      current.content !== version.content;
    if (isDifferent) {
      snapshotWorldEntry(current);
    }

    run(
      'UPDATE misc_records SET title = ?, category = ?, content = ?, updated_at = ? WHERE id = ?',
      [version.title, version.category, version.content, now(), recordId]
    );
    return getWorldEntry(recordId);
  });
}
