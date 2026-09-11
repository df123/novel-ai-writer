// 时间线领域服务：版本快照 + 软删除 + 回收站，REST 与 MCP 共用
import { query, run } from '../../db';
import { withWriteTransaction } from '../../db/transaction';
import { generateId, now } from '../../utils/helpers';
import { formatTimelineNode, formatTimelineVersion } from '../../utils/formatters';
import { notFound, assertUpdatedAtMatch } from './errors';
import type { DbTimelineNode, DbTimelineVersion, TimelineNode, TimelineNodeVersion } from '@shared/types';

export interface Scope {
  projectId?: string;
}

/** 创建时间线事件入参 */
export interface TimelineEventInput {
  title: string;
  date?: string;
  content?: string;
  orderIndex?: number;
}

/** 读取原始时间线记录（含已软删除），不存在抛 NOT_FOUND */
function requireTimelineNode(id: string, scope?: Scope): DbTimelineNode {
  const nodes = query<DbTimelineNode>('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
  if (nodes.length === 0) {
    throw notFound('时间线节点未找到');
  }
  if (scope?.projectId && nodes[0].project_id !== scope.projectId) {
    throw notFound('时间线节点未找到');
  }
  return nodes[0];
}

function nextVersion(nodeId: string): number {
  const rows = query<{ count: number }>(
    'SELECT COUNT(*) as count FROM timeline_versions WHERE timeline_node_id = ?',
    [nodeId]
  );
  return rows[0].count + 1;
}

function snapshotTimelineNode(node: DbTimelineNode): void {
  run(
    'INSERT INTO timeline_versions (id, timeline_node_id, title, date, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), node.id, node.title, node.date, node.content ?? null, nextVersion(node.id), now()]
  );
}

/** 列出项目时间线（支持模糊过滤） */
export function listTimelineEvents(
  projectId: string,
  filters?: { title?: string; content?: string }
): TimelineNode[] {
  let sql = 'SELECT * FROM timeline_nodes WHERE project_id = ? AND deleted = 0';
  const params: (string | number)[] = [projectId];
  if (filters?.title) {
    sql += ' AND title LIKE ?';
    params.push(`%${filters.title}%`);
  }
  if (filters?.content) {
    sql += ' AND content LIKE ?';
    params.push(`%${filters.content}%`);
  }
  sql += ' ORDER BY order_index ASC';
  return query<DbTimelineNode>(sql, params).map(formatTimelineNode);
}

/** 获取单个时间线事件（未删除） */
export function getTimelineEvent(id: string, scope?: Scope): TimelineNode {
  const node = requireTimelineNode(id, scope);
  if (node.deleted === 1) {
    throw notFound('时间线节点未找到');
  }
  return formatTimelineNode(node);
}

/** 创建时间线事件 */
export function createTimelineEvent(projectId: string, input: TimelineEventInput): TimelineNode {
  const id = generateId();
  const ts = now();
  withWriteTransaction(() => {
    run(
      'INSERT INTO timeline_nodes (id, project_id, title, date, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, input.title, input.date || null, input.content || null, input.orderIndex || 0, ts, ts]
    );
  });
  return getTimelineEvent(id);
}

/**
 * 更新时间线事件（部分字段；未提供的字段保持原值）
 * @param createVersion 是否先保存旧状态快照
 * @param expectedUpdatedAt 乐观并发检查（可选，Unix 秒）
 */
export function updateTimelineEvent(
  id: string,
  input: Partial<TimelineEventInput>,
  options?: { createVersion?: boolean; expectedUpdatedAt?: number },
  scope?: Scope
): TimelineNode {
  return withWriteTransaction(() => {
    const existing = requireTimelineNode(id, scope);
    assertUpdatedAtMatch(options?.expectedUpdatedAt, existing.updated_at, 'Timeline event');

    if (options?.createVersion) {
      snapshotTimelineNode(existing);
    }

    run(
      'UPDATE timeline_nodes SET title = ?, date = ?, content = ?, order_index = ?, updated_at = ? WHERE id = ?',
      [
        input.title !== undefined ? input.title : existing.title,
        input.date !== undefined ? input.date : existing.date,
        input.content !== undefined ? (input.content ?? null) : existing.content,
        input.orderIndex !== undefined ? input.orderIndex : existing.order_index,
        now(),
        id
      ]
    );
    return getTimelineEvent(id);
  });
}

/** 软删除时间线事件 */
export function archiveTimelineEvent(id: string, scope?: Scope): void {
  withWriteTransaction(() => {
    requireTimelineNode(id, scope);
    run('UPDATE timeline_nodes SET deleted = 1, deleted_at = ? WHERE id = ?', [now(), id]);
  });
}

/** 从回收站恢复时间线事件 */
export function restoreTimelineEvent(id: string): TimelineNode {
  return withWriteTransaction(() => {
    requireTimelineNode(id);
    run('UPDATE timeline_nodes SET deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
    return getTimelineEvent(id);
  });
}

/** 永久删除时间线事件（仅限已软删除，供原 Web 管理界面使用，不暴露给 MCP） */
export function permanentDeleteTimelineEvent(id: string): void {
  withWriteTransaction(() => {
    const existing = requireTimelineNode(id);
    if (existing.deleted === 0) {
      throw notFound('只能永久删除已软删除的时间线节点');
    }
    run('DELETE FROM timeline_nodes WHERE id = ?', [id]);
  });
}

/** 项目时间线回收站 */
export function listTimelineTrash(projectId: string): TimelineNode[] {
  return query<DbTimelineNode>(
    'SELECT * FROM timeline_nodes WHERE project_id = ? AND deleted = 1 ORDER BY deleted_at DESC',
    [projectId]
  ).map(formatTimelineNode);
}

/** 时间线版本历史 */
export function listTimelineVersions(nodeId: string): TimelineNodeVersion[] {
  return query<DbTimelineVersion>(
    'SELECT * FROM timeline_versions WHERE timeline_node_id = ? ORDER BY version DESC',
    [nodeId]
  ).map(formatTimelineVersion);
}

/** 恢复时间线事件到指定版本 */
export function restoreTimelineVersion(nodeId: string, versionId: string): TimelineNode {
  return withWriteTransaction(() => {
    const versions = query<DbTimelineVersion>(
      'SELECT * FROM timeline_versions WHERE id = ? AND timeline_node_id = ?',
      [versionId, nodeId]
    );
    if (versions.length === 0) {
      throw notFound('版本未找到');
    }
    const version = versions[0];
    const current = requireTimelineNode(nodeId);

    const isDifferent =
      current.title !== version.title ||
      current.date !== version.date ||
      current.content !== version.content;
    if (isDifferent) {
      snapshotTimelineNode(current);
    }

    run(
      'UPDATE timeline_nodes SET title = ?, date = ?, content = ?, updated_at = ? WHERE id = ?',
      [version.title, version.date, version.content, now(), nodeId]
    );
    return getTimelineEvent(nodeId);
  });
}
