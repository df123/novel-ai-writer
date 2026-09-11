// 故事条目统一读取/版本服务：get_story_item 及跨实体版本与回收站操作
import { query } from '../../db';
import { notFound, invalidArgument } from './errors';
import type { Character, TimelineNode, MiscRecord, Chapter, Theme } from '@shared/types';
import { getTheme, listThemeHistory, updateTheme } from './themeService';
import {
  getCharacter,
  listCharacterVersions,
  restoreCharacterVersion,
  listCharacterTrash,
  restoreCharacter
} from './characterService';
import {
  getTimelineEvent,
  listTimelineVersions,
  restoreTimelineVersion,
  listTimelineTrash,
  restoreTimelineEvent
} from './timelineService';
import {
  getWorldEntry,
  listWorldEntryVersions,
  restoreWorldEntryVersion,
  listWorldEntryTrash,
  restoreWorldEntry
} from './worldEntryService';
import {
  getChapter,
  listChapterVersions,
  restoreChapterVersion,
  listChapterTrash,
  restoreChapter
} from './chapterService';
import type { StoryItemType } from './storySearchService';

/** 按类型读取完整实体，并验证其归属传入的项目（防跨项目误读） */
export function getStoryItem(
  projectId: string,
  type: StoryItemType,
  id: string
): { type: StoryItemType; theme?: Theme; character?: Character; timeline_event?: TimelineNode; world_entry?: MiscRecord; chapter?: Chapter } {
  const scope = { projectId };
  switch (type) {
    case 'theme':
      return { type, theme: getTheme(id, scope) };
    case 'character':
      return { type, character: getCharacter(id, scope) };
    case 'timeline':
      return { type, timeline_event: getTimelineEvent(id, scope) };
    case 'world_entry':
      return { type, world_entry: getWorldEntry(id, scope) };
    case 'chapter':
      return { type, chapter: getChapter(projectId, id) };
    default:
      throw invalidArgument(`未知的条目类型: ${type}`);
  }
}

/** 各类型的版本列表（供 MCP list_item_versions） */
export function listItemVersions(projectId: string, type: StoryItemType, id: string): unknown[] {
  // 先做归属校验，防止跨项目枚举版本
  getStoryItem(projectId, type, id);
  switch (type) {
    case 'theme':
      return listThemeHistory(id);
    case 'character':
      return listCharacterVersions(id);
    case 'timeline':
      return listTimelineVersions(id);
    case 'world_entry':
      return listWorldEntryVersions(id);
    case 'chapter':
      return listChapterVersions(id);
    default:
      throw invalidArgument(`未知的条目类型: ${type}`);
  }
}

/** 恢复到指定版本（供 MCP restore_item_version；恢复动作本身也会先快照当前状态） */
export function restoreItemVersion(projectId: string, type: StoryItemType, id: string, versionId: string): unknown {
  switch (type) {
    case 'theme': {
      // 主题历史版本记录的是 content 快照：读取后走 updateTheme（会再快照当前内容）
      getStoryItem(projectId, 'theme', id);
      const record = query<{ content: string }>(
        'SELECT content FROM theme_history WHERE id = ? AND theme_id = ?',
        [versionId, id]
      );
      if (record.length === 0) {
        throw notFound('版本未找到');
      }
      return updateTheme(id, { content: record[0].content });
    }
    case 'character': {
      getStoryItem(projectId, 'character', id);
      return restoreCharacterVersion(id, versionId);
    }
    case 'timeline': {
      getStoryItem(projectId, 'timeline', id);
      return restoreTimelineVersion(id, versionId);
    }
    case 'world_entry': {
      getStoryItem(projectId, 'world_entry', id);
      return restoreWorldEntryVersion(id, versionId);
    }
    case 'chapter':
      return restoreChapterVersion(projectId, id, versionId);
    default:
      throw invalidArgument(`未知的条目类型: ${type}`);
  }
}

/** 各类型回收站列表（供 MCP list_trash） */
export function listTrash(projectId: string, type: StoryItemType): unknown[] {
  switch (type) {
    case 'character':
      return listCharacterTrash(projectId);
    case 'timeline':
      return listTimelineTrash(projectId);
    case 'world_entry':
      return listWorldEntryTrash(projectId);
    case 'chapter':
      return listChapterTrash(projectId);
    case 'theme':
      throw invalidArgument('主题不支持回收站列表，请使用 get_story_context 查看');
    default:
      throw invalidArgument(`未知的条目类型: ${type}`);
  }
}

/** 从回收站恢复实体（供 MCP restore_item） */
export function restoreItem(projectId: string, type: StoryItemType, id: string): unknown {
  switch (type) {
    case 'character':
      assertTrashedOwnership('characters', id, projectId);
      return restoreCharacter(id);
    case 'timeline':
      assertTrashedOwnership('timeline_nodes', id, projectId);
      return restoreTimelineEvent(id);
    case 'world_entry':
      assertTrashedOwnership('misc_records', id, projectId);
      return restoreWorldEntry(id);
    case 'chapter':
      return restoreChapter(projectId, id);
    case 'theme':
      throw invalidArgument('主题恢复请使用主题专用接口');
    default:
      throw notFound('未知的条目类型');
  }
}

/** 校验回收站内实体的项目归属（软删除行也必须匹配 project_id） */
function assertTrashedOwnership(
  table: 'characters' | 'timeline_nodes' | 'misc_records',
  id: string,
  projectId: string
): void {
  const rows = query<{ project_id: string }>(`SELECT project_id FROM ${table} WHERE id = ?`, [id]);
  if (rows.length === 0 || rows[0].project_id !== projectId) {
    throw notFound('条目未找到');
  }
}
