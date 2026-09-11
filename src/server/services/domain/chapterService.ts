// 章节领域服务：更新自动写入 chapter_versions 快照（Web 与 MCP 共用，均获得版本保护）
import { query, run } from '../../db';
import { withWriteTransaction, projectExists } from '../../db/transaction';
import { generateId, now } from '../../utils/helpers';
import { formatChapter } from '../../utils/formatters';
import { notFound, invalidArgument, conflict, assertUpdatedAtMatch } from './errors';
import type { DbChapter, DbChapterVersion, Chapter, ChapterVersion } from '@shared/types';

/** 创建章节入参 */
export interface ChapterInput {
  chapterNumber: number;
  title: string;
  content: string;
  sourceMessageId?: string;
}

/** 读取原始章节记录（含已软删除），不存在抛 NOT_FOUND */
function requireChapter(projectId: string, chapterId: string): DbChapter {
  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE id = ? AND project_id = ?',
    [chapterId, projectId]
  );
  if (chapters.length === 0) {
    throw notFound('章节未找到');
  }
  return chapters[0];
}

function nextVersion(chapterId: string): number {
  const rows = query<{ count: number }>(
    'SELECT COUNT(*) as count FROM chapter_versions WHERE chapter_id = ?',
    [chapterId]
  );
  return rows[0].count + 1;
}

/** 将当前章节状态写入版本快照 */
function snapshotChapter(chapter: DbChapter): void {
  run(
    'INSERT INTO chapter_versions (id, chapter_id, chapter_number, title, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), chapter.id, chapter.chapter_number, chapter.title, chapter.content, nextVersion(chapter.id), now()]
  );
}

/** 章节列表（未删除，按编号升序） */
export function listChapters(projectId: string): Chapter[] {
  return query<DbChapter>(
    'SELECT * FROM chapters WHERE project_id = ? AND deleted = 0 ORDER BY chapter_number ASC',
    [projectId]
  ).map(formatChapter);
}

/** 获取单个章节 */
export function getChapter(projectId: string, chapterId: string): Chapter {
  if (!projectExists(projectId)) {
    throw notFound('项目不存在');
  }
  const chapters = query<DbChapter>(
    'SELECT * FROM chapters WHERE id = ? AND project_id = ? AND deleted = 0',
    [chapterId, projectId]
  );
  if (chapters.length === 0) {
    throw notFound('章节未找到');
  }
  return formatChapter(chapters[0]);
}

/** 创建章节（编号冲突抛 CONFLICT） */
export function createChapter(projectId: string, input: ChapterInput): Chapter {
  if (!projectExists(projectId)) {
    throw notFound('项目不存在');
  }
  if (!input.chapterNumber || !input.title || !input.content) {
    throw invalidArgument('章节编号、标题和内容为必填字段');
  }
  return withWriteTransaction(() => {
    const duplicate = query<DbChapter>(
      'SELECT * FROM chapters WHERE project_id = ? AND chapter_number = ? AND deleted = 0',
      [projectId, input.chapterNumber]
    );
    if (duplicate.length > 0) {
      throw conflict('章节编号已存在', `Use a different chapter number, or archive the existing chapter ${input.chapterNumber} first.`);
    }

    const id = generateId();
    const ts = now();
    run(
      'INSERT INTO chapters (id, project_id, chapter_number, title, content, source_message_id, deleted, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)',
      [id, projectId, input.chapterNumber, input.title, input.content, input.sourceMessageId || null, ts, ts]
    );
    return getChapter(projectId, id);
  });
}

/**
 * 更新章节：先保存旧状态快照到 chapter_versions，再更新（版本保护为服务器规则，不可关闭）
 * @param expectedUpdatedAt 乐观并发检查（可选，Unix 秒）
 */
export function updateChapter(
  projectId: string,
  chapterId: string,
  input: { title?: string; chapterNumber?: number; content?: string },
  options?: { expectedUpdatedAt?: number }
): Chapter {
  return withWriteTransaction(() => {
    if (!projectExists(projectId)) {
      throw notFound('项目不存在');
    }
    const existing = requireChapter(projectId, chapterId);
    assertUpdatedAtMatch(options?.expectedUpdatedAt, existing.updated_at, 'Chapter');

    if (input.chapterNumber !== undefined) {
      const duplicate = query<DbChapter>(
        'SELECT * FROM chapters WHERE project_id = ? AND chapter_number = ? AND id != ? AND deleted = 0',
        [projectId, input.chapterNumber, chapterId]
      );
      if (duplicate.length > 0) {
        throw conflict('章节编号已存在', `Chapter number ${input.chapterNumber} is already used by another chapter.`);
      }
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];
    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.chapterNumber !== undefined) {
      updates.push('chapter_number = ?');
      params.push(input.chapterNumber);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      params.push(input.content);
    }
    if (updates.length === 0) {
      throw invalidArgument('没有提供任何更新内容');
    }

    snapshotChapter(existing);
    updates.push('updated_at = ?');
    params.push(now());
    params.push(chapterId);
    run(`UPDATE chapters SET ${updates.join(', ')} WHERE id = ?`, params);
    return getChapter(projectId, chapterId);
  });
}

/** 软删除章节 */
export function archiveChapter(projectId: string, chapterId: string): void {
  withWriteTransaction(() => {
    if (!projectExists(projectId)) {
      throw notFound('项目不存在');
    }
    requireChapter(projectId, chapterId);
    run('UPDATE chapters SET deleted = 1, deleted_at = ? WHERE id = ?', [now(), chapterId]);
  });
}

/** 从回收站恢复章节（编号冲突抛 CONFLICT） */
export function restoreChapter(projectId: string, chapterId: string): Chapter {
  return withWriteTransaction(() => {
    if (!projectExists(projectId)) {
      throw notFound('项目不存在');
    }
    const existing = requireChapter(projectId, chapterId);
    const duplicate = query<DbChapter>(
      'SELECT * FROM chapters WHERE project_id = ? AND chapter_number = ? AND deleted = 0 AND id != ?',
      [projectId, existing.chapter_number, chapterId]
    );
    if (duplicate.length > 0) {
      throw conflict('章节编号已存在，无法恢复', `Chapter number ${existing.chapter_number} is currently active on another chapter.`);
    }
    run('UPDATE chapters SET deleted = 0, deleted_at = NULL WHERE id = ?', [chapterId]);
    return getChapter(projectId, chapterId);
  });
}

/** 永久删除章节（仅限已软删除，供原 Web 管理界面使用，不暴露给 MCP） */
export function permanentDeleteChapter(projectId: string, chapterId: string): void {
  withWriteTransaction(() => {
    if (!projectExists(projectId)) {
      throw notFound('项目不存在');
    }
    const existing = requireChapter(projectId, chapterId);
    if (existing.deleted === 0) {
      throw invalidArgument('只能永久删除已软删除的章节');
    }
    run('DELETE FROM chapters WHERE id = ?', [chapterId]);
  });
}

/** 清空章节回收站（供原 Web 管理界面使用） */
export function emptyChapterTrash(projectId: string): void {
  withWriteTransaction(() => {
    run('DELETE FROM chapters WHERE project_id = ? AND deleted = 1', [projectId]);
  });
}

/** 章节回收站 */
export function listChapterTrash(projectId: string): Chapter[] {
  return query<DbChapter>(
    'SELECT * FROM chapters WHERE project_id = ? AND deleted = 1 ORDER BY deleted_at DESC',
    [projectId]
  ).map(formatChapter);
}

/** 批量更新章节排序 */
export function updateChapterOrder(
  projectId: string,
  chapters: Array<{ id: string; chapterNumber: number }>
): Chapter[] {
  return withWriteTransaction(() => {
    if (!projectExists(projectId)) {
      throw notFound('项目不存在');
    }
    if (!Array.isArray(chapters) || chapters.length === 0) {
      throw invalidArgument('请提供章节列表');
    }
    for (const chapter of chapters) {
      if (!chapter.id || typeof chapter.chapterNumber !== 'number') {
        throw invalidArgument('章节数据格式错误');
      }
    }
    const numbers = chapters.map(c => c.chapterNumber);
    if (numbers.length !== new Set(numbers).size) {
      throw invalidArgument('章节编号不能重复');
    }
    const ts = now();
    for (const chapter of chapters) {
      run(
        'UPDATE chapters SET chapter_number = ?, updated_at = ? WHERE id = ? AND project_id = ?',
        [chapter.chapterNumber, ts, chapter.id, projectId]
      );
    }
    return listChapters(projectId);
  });
}

/** 章节版本历史 */
export function listChapterVersions(chapterId: string): ChapterVersion[] {
  return query<DbChapterVersion>(
    'SELECT * FROM chapter_versions WHERE chapter_id = ? ORDER BY version DESC',
    [chapterId]
  ).map(v => ({
    id: v.id,
    chapterId: v.chapter_id,
    chapterNumber: v.chapter_number,
    title: v.title,
    content: v.content,
    version: v.version,
    createdAt: v.created_at
  }));
}

/** 恢复章节到指定版本（恢复前若当前状态不同则先快照当前状态） */
export function restoreChapterVersion(projectId: string, chapterId: string, versionId: string): Chapter {
  return withWriteTransaction(() => {
    const existing = requireChapter(projectId, chapterId);
    const versions = query<DbChapterVersion>(
      'SELECT * FROM chapter_versions WHERE id = ? AND chapter_id = ?',
      [versionId, chapterId]
    );
    if (versions.length === 0) {
      throw notFound('版本未找到');
    }
    const version = versions[0];

    // 编号被其他未删除章节占用时不允许恢复
    if (version.chapter_number !== existing.chapter_number) {
      const duplicate = query<DbChapter>(
        'SELECT * FROM chapters WHERE project_id = ? AND chapter_number = ? AND deleted = 0 AND id != ?',
        [projectId, version.chapter_number, chapterId]
      );
      if (duplicate.length > 0) {
        throw conflict('章节编号已存在，无法恢复该版本', `Chapter number ${version.chapter_number} is active on another chapter.`);
      }
    }

    const isDifferent =
      existing.title !== version.title ||
      existing.chapter_number !== version.chapter_number ||
      existing.content !== version.content;
    if (isDifferent) {
      snapshotChapter(existing);
    }

    run(
      'UPDATE chapters SET chapter_number = ?, title = ?, content = ?, updated_at = ? WHERE id = ?',
      [version.chapter_number, version.title, version.content, now(), chapterId]
    );
    return getChapter(projectId, chapterId);
  });
}
