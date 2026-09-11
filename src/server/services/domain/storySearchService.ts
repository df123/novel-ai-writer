// 小说全文搜索服务：跨主旨/角色/时间线/世界观/章节的 LIKE 参数化检索
import { query } from '../../db';
import { notFound, invalidArgument } from './errors';

/** 可检索的故事实体类型 */
export type StoryItemType = 'theme' | 'character' | 'timeline' | 'world_entry' | 'chapter';

export const STORY_ITEM_TYPES: readonly StoryItemType[] = [
  'theme',
  'character',
  'timeline',
  'world_entry',
  'chapter'
] as const;

export interface SearchStoryResult {
  type: StoryItemType;
  id: string;
  title: string;
  snippet: string;
}

const SNIPPET_MAX = 200;
const LIMIT_MAX = 100;
const LIMIT_DEFAULT = 20;

/** 转义 LIKE 通配符，使查询按字面匹配 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, ch => `\\${ch}`);
}

/** 从正文中提取命中所附近的片段 */
function makeSnippet(content: string | null, needle: string): string {
  const text = content ?? '';
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return text.slice(0, SNIPPET_MAX);
  const start = Math.max(0, idx - 60);
  return (start > 0 ? '…' : '') + text.slice(start, start + SNIPPET_MAX);
}

/**
 * 跨实体搜索小说内容
 * @param types 限定搜索的实体类型集合，默认全部
 * @param limit 结果数量上限（1~100，默认 20）
 */
export function searchStory(
  projectId: string,
  searchText: string,
  types?: StoryItemType[],
  limit?: number
): { results: SearchStoryResult[] } {
  const rows = query<{ count: number }>('SELECT COUNT(*) as count FROM projects WHERE id = ?', [projectId]);
  if (rows[0].count === 0) {
    throw notFound('项目未找到');
  }
  if (!searchText.trim()) {
    throw invalidArgument('搜索关键词不能为空');
  }

  const searchTypes = types && types.length > 0 ? types : [...STORY_ITEM_TYPES];
  const effectiveLimit = Math.min(Math.max(limit ?? LIMIT_DEFAULT, 1), LIMIT_MAX);
  const like = `%${escapeLike(searchText.trim())}%`;

  const results: SearchStoryResult[] = [];

  if (searchTypes.includes('theme')) {
    const themes = query<{ id: string; title: string; content: string }>(
      `SELECT id, title, content FROM themes WHERE project_id = ? AND deleted = 0 AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')`,
      [projectId, like, like]
    );
    for (const t of themes) {
      results.push({ type: 'theme', id: t.id, title: t.title, snippet: makeSnippet(t.content, searchText.trim()) });
    }
  }

  if (searchTypes.includes('character')) {
    const characters = query<{ id: string; name: string; personality: string | null; background: string | null; relationships: string | null }>(
      `SELECT id, name, personality, background, relationships FROM characters WHERE project_id = ? AND deleted = 0 AND (name LIKE ? ESCAPE '\\' OR personality LIKE ? ESCAPE '\\' OR background LIKE ? ESCAPE '\\' OR relationships LIKE ? ESCAPE '\\')`,
      [projectId, like, like, like, like]
    );
    for (const c of characters) {
      const snippet = makeSnippet(c.personality || c.background || c.relationships, searchText.trim());
      results.push({ type: 'character', id: c.id, title: c.name, snippet });
    }
  }

  if (searchTypes.includes('timeline')) {
    const nodes = query<{ id: string; title: string; content: string | null }>(
      `SELECT id, title, content FROM timeline_nodes WHERE project_id = ? AND deleted = 0 AND (title LIKE ? ESCAPE '\\' OR date LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')`,
      [projectId, like, like, like]
    );
    for (const t of nodes) {
      results.push({ type: 'timeline', id: t.id, title: t.title, snippet: makeSnippet(t.content, searchText.trim()) });
    }
  }

  if (searchTypes.includes('world_entry')) {
    const records = query<{ id: string; title: string; category: string | null; content: string | null }>(
      `SELECT id, title, category, content FROM misc_records WHERE project_id = ? AND deleted = 0 AND (title LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')`,
      [projectId, like, like, like]
    );
    for (const r of records) {
      const label = r.category ? `${r.title} [${r.category}]` : r.title;
      results.push({ type: 'world_entry', id: r.id, title: label, snippet: makeSnippet(r.content, searchText.trim()) });
    }
  }

  if (searchTypes.includes('chapter')) {
    const chapters = query<{ id: string; title: string; chapter_number: number; content: string }>(
      `SELECT id, title, chapter_number, content FROM chapters WHERE project_id = ? AND deleted = 0 AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')`,
      [projectId, like, like]
    );
    for (const c of chapters) {
      results.push({ type: 'chapter', id: c.id, title: `第${c.chapter_number}章 ${c.title}`, snippet: makeSnippet(c.content, searchText.trim()) });
    }
  }

  return { results: results.slice(0, effectiveLimit) };
}
