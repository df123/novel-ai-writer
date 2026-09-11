// 主旨领域服务：每项目单例，更新自动写入 theme_history 快照
import { query, run } from '../../db';
import { withWriteTransaction, projectExists } from '../../db/transaction';
import { generateId, now } from '../../utils/helpers';
import { formatTheme, formatThemeHistory } from '../../utils/formatters';
import { notFound, invalidArgument, assertUpdatedAtMatch } from './errors';
import type { DbTheme, DbThemeHistory, Theme, ThemeHistory } from '@shared/types';

/** created_by 合法值（保持现有数据库语义，MCP 修改时记录为 llm） */
export type ThemeCreatedBy = 'user' | 'llm';

/** 主旨创建入参 */
export interface ThemeInput {
  title: string;
  content: string;
  createdBy?: ThemeCreatedBy;
}

/** 归属范围：传入时校验主题属于该项目，防止跨项目误操作 */
export interface Scope {
  projectId?: string;
}

/** 校验 created_by 取值 */
function normalizeCreatedBy(createdBy?: string): ThemeCreatedBy {
  if (createdBy !== undefined && createdBy !== 'user' && createdBy !== 'llm') {
    throw invalidArgument('created_by 必须为 user 或 llm');
  }
  return createdBy || 'user';
}

/** 获取项目当前主旨（不存在返回 null，项目不存在抛 NOT_FOUND） */
export function getThemeByProject(projectId: string): Theme | null {
  if (!projectExists(projectId)) {
    throw notFound('项目不存在');
  }
  const themes = query<DbTheme>(
    'SELECT * FROM themes WHERE project_id = ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 1',
    [projectId]
  );
  return themes.length > 0 ? formatTheme(themes[0]) : null;
}

/** 获取单个主旨 */
export function getTheme(id: string, scope?: Scope): Theme {
  const themes = query<DbTheme>('SELECT * FROM themes WHERE id = ? AND deleted = 0', [id]);
  if (themes.length === 0) {
    throw notFound('主旨未找到');
  }
  if (scope?.projectId && themes[0].project_id !== scope.projectId) {
    throw notFound('主旨未找到');
  }
  return formatTheme(themes[0]);
}

/**
 * 创建或更新项目主旨（upsert 语义，与现有 REST POST 行为一致）
 * 已存在时自动将旧内容写入 theme_history 再更新
 */
export function upsertTheme(projectId: string, input: ThemeInput, options?: { expectedUpdatedAt?: number }): Theme {
  if (!projectExists(projectId)) {
    throw notFound('项目不存在');
  }
  if (!input.title || !input.content) {
    throw invalidArgument('标题和内容为必填字段');
  }
  const createdBy = normalizeCreatedBy(input.createdBy);

  return withWriteTransaction(() => {
    const existing = query<DbTheme>(
      'SELECT * FROM themes WHERE project_id = ? AND deleted = 0',
      [projectId]
    );

    if (existing.length > 0) {
      const current = existing[0];
      assertUpdatedAtMatch(options?.expectedUpdatedAt, current.updated_at, 'Theme');

      // 旧状态快照入历史，版本号递增
      run(
        'INSERT INTO theme_history (id, theme_id, content, version, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), current.id, current.content, current.version, current.created_by, now()]
      );
      run(
        'UPDATE themes SET title = ?, content = ?, version = ?, created_by = ?, updated_at = ? WHERE id = ?',
        [input.title, input.content, current.version + 1, createdBy, now(), current.id]
      );
      return getTheme(current.id);
    }

    const id = generateId();
    const ts = now();
    run(
      'INSERT INTO themes (id, project_id, title, content, version, created_by, deleted, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, 0, NULL, ?, ?)',
      [id, projectId, input.title, input.content, createdBy, ts, ts]
    );
    return getTheme(id);
  });
}

/** 部分更新主旨（自动写历史快照，与现有 REST PUT 行为一致） */
export function updateTheme(
  id: string,
  input: { title?: string; content?: string; createdBy?: string },
  options?: { expectedUpdatedAt?: number }
): Theme {
  return withWriteTransaction(() => {
    const existing = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw notFound('主旨未找到');
    }
    const current = existing[0];
    if (input.title === undefined && input.content === undefined && input.createdBy === undefined) {
      throw invalidArgument('没有提供任何更新内容');
    }
    const createdBy = normalizeCreatedBy(input.createdBy);
    assertUpdatedAtMatch(options?.expectedUpdatedAt, current.updated_at, 'Theme');

    run(
      'INSERT INTO theme_history (id, theme_id, content, version, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), id, current.content, current.version, current.created_by, now()]
    );

    const updates: string[] = [];
    const params: (string | number)[] = [];
    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      params.push(input.content);
    }
    if (input.createdBy !== undefined) {
      updates.push('created_by = ?');
      params.push(createdBy);
    }
    updates.push('version = ?');
    params.push(current.version + 1);
    updates.push('updated_at = ?');
    params.push(now());
    params.push(id);

    run(`UPDATE themes SET ${updates.join(', ')} WHERE id = ?`, params);
    return getTheme(id);
  });
}

/** 软删除主旨 */
export function archiveTheme(id: string): void {
  withWriteTransaction(() => {
    run('UPDATE themes SET deleted = 1, deleted_at = ? WHERE id = ?', [now(), id]);
  });
}

/** 恢复软删除的主旨 */
export function restoreTheme(id: string): Theme {
  return withWriteTransaction(() => {
    const existing = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw notFound('主旨未找到');
    }
    run('UPDATE themes SET deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
    return getTheme(id);
  });
}

/** 主旨历史版本列表（按版本号倒序） */
export function listThemeHistory(id: string): ThemeHistory[] {
  const themes = query<DbTheme>('SELECT * FROM themes WHERE id = ?', [id]);
  if (themes.length === 0) {
    throw notFound('主旨未找到');
  }
  const history = query<DbThemeHistory>(
    'SELECT * FROM theme_history WHERE theme_id = ? ORDER BY version DESC',
    [id]
  );
  return history.map(formatThemeHistory);
}

/** 获取主旨指定历史版本 */
export function getThemeHistoryVersion(id: string, version: number): ThemeHistory {
  const history = query<DbThemeHistory>(
    'SELECT * FROM theme_history WHERE theme_id = ? AND version = ?',
    [id, version]
  );
  if (history.length === 0) {
    throw notFound('未找到指定版本的历史记录');
  }
  return formatThemeHistory(history[0]);
}
