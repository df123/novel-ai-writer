// 项目领域服务：REST 与 MCP 共用的项目业务规则
import { query, run } from '../../db';
import { withWriteTransaction } from '../../db/transaction';
import { generateId, now } from '../../utils/helpers';
import { formatProject } from '../../utils/formatters';
import { notFound, assertUpdatedAtMatch } from './errors';
import type { DbProject, Project } from '@shared/types';

/** 项目创建/更新入参 */
export interface ProjectInput {
  title: string;
  description?: string;
}

/** 列出全部项目（按更新时间倒序） */
export function listProjects(): Project[] {
  const projects = query<DbProject>('SELECT * FROM projects ORDER BY updated_at DESC');
  return projects.map(formatProject);
}

/** 获取单个项目，不存在时抛 NOT_FOUND */
export function getProject(id: string): Project {
  const projects = query<DbProject>('SELECT * FROM projects WHERE id = ?', [id]);
  if (projects.length === 0) {
    throw notFound('项目未找到');
  }
  return formatProject(projects[0]);
}

/** 创建项目 */
export function createProject(input: ProjectInput): Project {
  const id = generateId();
  const ts = now();

  withWriteTransaction(() => {
    run(
      'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, input.title, input.description || null, ts, ts]
    );
  });

  return getProject(id);
}

/**
 * 更新项目
 * @param expectedUpdatedAt 乐观并发检查（可选，Unix 秒）
 */
export function updateProject(
  id: string,
  input: Partial<ProjectInput>,
  options?: { expectedUpdatedAt?: number }
): Project {
  return withWriteTransaction(() => {
    const existing = query<DbProject>('SELECT * FROM projects WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw notFound('项目未找到');
    }
    assertUpdatedAtMatch(options?.expectedUpdatedAt, existing[0].updated_at, 'Project');

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    if (input.title !== undefined) {
      updates.push('name = ?');
      params.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description || null);
    }
    if (updates.length === 0) {
      return formatProject(existing[0]);
    }
    updates.push('updated_at = ?');
    params.push(now());
    params.push(id);
    run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = query<DbProject>('SELECT * FROM projects WHERE id = ?', [id]);
    return formatProject(updated[0]);
  });
}
