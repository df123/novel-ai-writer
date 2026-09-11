// 故事上下文服务：MCP 最核心的读取入口，组装小说全局结构化记忆
// 章节只返回索引（正文需另行 get_chapter），防 token 失控
import { query } from '../../db';
import { notFound } from './errors';
import type {
  DbProject,
  DbTheme,
  DbCharacter,
  DbTimelineNode,
  DbMiscRecord,
  DbChapter
} from '@shared/types';

/** 单类型上限、字段截断长度与摘要截断长度 */
const LIMITS = {
  characters: 100,
  timeline: 100,
  worldEntries: 200,
  worldEntrySummaryChars: 300,
  characterPersonalityChars: 2000,
  characterBackgroundChars: 3000,
  characterRelationshipsChars: 3000,
  timelineContentChars: 3000,
  themeContentChars: 5000
} as const;

/** 截断文本,超出时返回截断值,否则原样 */
function clampText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

export interface StoryContextCharacter {
  id: string;
  name: string;
  personality: string;
  background: string;
  relationships: string;
  updated_at: number;
}

export interface StoryContextTimelineEvent {
  id: string;
  date: string;
  title: string;
  content: string;
  updated_at: number;
}

export interface StoryContextWorldEntry {
  id: string;
  category: string;
  title: string;
  summary: string;
  updated_at: number;
}

export interface StoryContextChapterIndex {
  id: string;
  chapter_number: number;
  title: string;
  updated_at: number;
}

export interface StoryContext {
  project: {
    id: string;
    title: string;
    description: string;
    updated_at: number;
  };
  theme: {
    id: string;
    title: string;
    content: string;
    version: number;
    updated_at: number;
  } | null;
  characters: StoryContextCharacter[];
  timeline: StoryContextTimelineEvent[];
  world_entries: StoryContextWorldEntry[];
  chapters: StoryContextChapterIndex[];
  truncated: boolean;
  truncated_note: string | null;
}

/**
 * 组装项目完整故事上下文
 * 各集合有数量上限，超限时 truncated=true 并提示改用 search_story / get_story_item
 */
export function getStoryContext(projectId: string): StoryContext {
  const projects = query<DbProject>('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (projects.length === 0) {
    throw notFound('项目未找到');
  }
  const project = projects[0];

  const themes = query<DbTheme>(
    'SELECT * FROM themes WHERE project_id = ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 1',
    [projectId]
  );

  const allCharacters = query<DbCharacter>(
    'SELECT * FROM characters WHERE project_id = ? AND deleted = 0 ORDER BY created_at ASC',
    [projectId]
  );
  const allTimeline = query<DbTimelineNode>(
    'SELECT * FROM timeline_nodes WHERE project_id = ? AND deleted = 0 ORDER BY order_index ASC',
    [projectId]
  );
  const allWorldEntries = query<DbMiscRecord>(
    'SELECT * FROM misc_records WHERE project_id = ? AND deleted = 0 ORDER BY order_index ASC',
    [projectId]
  );
  const chapters = query<DbChapter>(
    'SELECT id, chapter_number, title, updated_at FROM chapters WHERE project_id = ? AND deleted = 0 ORDER BY chapter_number ASC',
    [projectId]
  );

  const truncatedParts: string[] = [];
  const characters = allCharacters.slice(0, LIMITS.characters);
  if (allCharacters.length > LIMITS.characters) {
    truncatedParts.push(`characters (showing ${LIMITS.characters} of ${allCharacters.length}, use search_story for the rest)`);
  }
  const timeline = allTimeline.slice(0, LIMITS.timeline);
  if (allTimeline.length > LIMITS.timeline) {
    truncatedParts.push(`timeline (showing ${LIMITS.timeline} of ${allTimeline.length}, use search_story for the rest)`);
  }
  const worldEntries = allWorldEntries.slice(0, LIMITS.worldEntries);
  if (allWorldEntries.length > LIMITS.worldEntries) {
    truncatedParts.push(`world_entries (showing ${LIMITS.worldEntries} of ${allWorldEntries.length}, use search_story for the rest)`);
  }

  // 单实体大字段截断:context 只给摘要,完整内容走 get_story_item
  for (const c of characters) {
    if ((c.personality ?? '').length > LIMITS.characterPersonalityChars) {
      truncatedParts.push(`character "${c.name}" personality truncated to ${LIMITS.characterPersonalityChars} chars (get_story_item for full text)`);
    }
    if ((c.background ?? '').length > LIMITS.characterBackgroundChars) {
      truncatedParts.push(`character "${c.name}" background truncated to ${LIMITS.characterBackgroundChars} chars (get_story_item for full text)`);
    }
    if ((c.relationships ?? '').length > LIMITS.characterRelationshipsChars) {
      truncatedParts.push(`character "${c.name}" relationships truncated to ${LIMITS.characterRelationshipsChars} chars (get_story_item for full text)`);
    }
  }
  for (const t of timeline) {
    if ((t.content ?? '').length > LIMITS.timelineContentChars) {
      truncatedParts.push(`timeline event "${t.title}" content truncated to ${LIMITS.timelineContentChars} chars (get_story_item for full text)`);
    }
  }
  let themeContent = '';
  if (themes.length > 0) {
    themeContent = themes[0].content;
    if (themeContent.length > LIMITS.themeContentChars) {
      truncatedParts.push(`theme content truncated to ${LIMITS.themeContentChars} chars (get_story_item/get_theme for full text)`);
      themeContent = clampText(themeContent, LIMITS.themeContentChars);
    }
  }

  return {
    project: {
      id: project.id,
      title: project.name,
      description: project.description ?? '',
      updated_at: project.updated_at
    },
    theme:
      themes.length > 0
        ? {
            id: themes[0].id,
            title: themes[0].title,
            content: themeContent,
            version: themes[0].version,
            updated_at: themes[0].updated_at
          }
        : null,
    characters: characters.map(c => ({
      id: c.id,
      name: c.name,
      personality: clampText(c.personality ?? '', LIMITS.characterPersonalityChars),
      background: clampText(c.background ?? '', LIMITS.characterBackgroundChars),
      relationships: clampText(c.relationships ?? '', LIMITS.characterRelationshipsChars),
      updated_at: c.updated_at
    })),
    timeline: timeline.map(t => ({
      id: t.id,
      date: t.date ?? '',
      title: t.title,
      content: clampText(t.content ?? '', LIMITS.timelineContentChars),
      updated_at: t.updated_at
    })),
    world_entries: worldEntries.map(w => ({
      id: w.id,
      category: w.category ?? '',
      title: w.title,
      summary: (w.content ?? '').slice(0, LIMITS.worldEntrySummaryChars),
      updated_at: w.updated_at
    })),
    chapters: chapters.map(c => ({
      id: (c as DbChapter).id,
      chapter_number: (c as DbChapter).chapter_number,
      title: (c as DbChapter).title,
      updated_at: (c as DbChapter).updated_at
    })),
    truncated: truncatedParts.length > 0,
    truncated_note: truncatedParts.length > 0 ? `Some collections were truncated: ${truncatedParts.join('; ')}.` : null
  };
}
