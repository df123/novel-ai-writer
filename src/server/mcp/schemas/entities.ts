// 各领域实体的输入 schema 原始形状（供 registerTool inputSchema 使用）
import { z } from 'zod';
import { projectIdSchema, idSchema, expectedUpdatedAtSchema, limitSchema, titleSchema } from './common';

// ===== Projects =====
export const listProjectsInput = {};

export const getProjectInput = {
  project_id: z.string().uuid().describe('Project UUID')
};

export const createProjectInput = {
  title: titleSchema,
  description: z.string().max(5000).optional().describe('Short description of the novel (optional)')
};

export const updateProjectInput = {
  project_id: projectIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
  expected_updated_at: expectedUpdatedAtSchema
};

// ===== Story Context / Search / Item =====
export const getStoryContextInput = {
  project_id: projectIdSchema
};

export const searchStoryInput = {
  project_id: projectIdSchema,
  query: z.string().min(1).max(500).describe('Search keyword (1-500 chars)'),
  types: z.array(z.enum(['character', 'timeline', 'world_entry', 'theme', 'chapter'])).optional().describe(
    'Entity types to search. Default: all types.'
  ),
  limit: limitSchema
};

export const getStoryItemInput = {
  project_id: projectIdSchema,
  type: z.enum(['theme', 'character', 'timeline', 'world_entry', 'chapter']).describe('Entity type'),
  id: idSchema.describe('Entity UUID obtained from context/search results')
};

// ===== Theme =====
export const getThemeInput = {
  project_id: projectIdSchema
};

export const upsertThemeInput = {
  project_id: projectIdSchema,
  title: titleSchema,
  content: z.string().min(1).max(200_000).describe('Full theme/premise content of the novel'),
  expected_updated_at: expectedUpdatedAtSchema
};

// ===== Timeline =====
export const createTimelineEventInput = {
  project_id: projectIdSchema,
  title: titleSchema.describe('Event title, e.g. "林浩进入青云宗"'),
  date: z.string().max(100).optional().describe('In-story date or time label, e.g. "第三年春"'),
  content: z.string().max(100_000).optional().describe('Event body text. This is the canonical Timeline content field.'),
  order_index: z.number().int().min(0).max(1_000_000).optional().describe('Sort order (default 0)')
};

export const updateTimelineEventInput = {
  project_id: projectIdSchema,
  event_id: idSchema.describe('Timeline event UUID'),
  title: titleSchema.optional(),
  date: z.string().max(100).optional(),
  content: z.string().max(100_000).optional().describe('Event body text (canonical field)'),
  order_index: z.number().int().min(0).max(1_000_000).optional(),
  expected_updated_at: expectedUpdatedAtSchema
};

export const archiveTimelineEventInput = {
  project_id: projectIdSchema,
  event_id: idSchema
};

// ===== Character =====
export const createCharacterInput = {
  project_id: projectIdSchema,
  name: z.string().min(1).max(300).describe('Character name'),
  personality: z.string().max(100_000).optional().describe('Personality traits'),
  background: z.string().max(100_000).optional().describe('Backstory'),
  relationships: z.string().max(100_000).optional().describe('Relationships to other characters')
};

export const updateCharacterInput = {
  project_id: projectIdSchema,
  character_id: idSchema,
  name: z.string().min(1).max(300).optional(),
  personality: z.string().max(100_000).optional(),
  background: z.string().max(100_000).optional(),
  relationships: z.string().max(100_000).optional(),
  expected_updated_at: expectedUpdatedAtSchema
};

export const archiveCharacterInput = {
  project_id: projectIdSchema,
  character_id: idSchema
};

// ===== World Entry =====
export const createWorldEntryInput = {
  project_id: projectIdSchema,
  title: titleSchema.describe('Entry title, e.g. "黑岩城"'),
  category: z.string().max(100).optional().describe(
    'Free-form category such as 城市/地点/宗门/组织/势力/国家/种族/功法/武器/物品/历史资料/其他'
  ),
  content: z.string().max(200_000).optional().describe('Full entry content')
};

export const updateWorldEntryInput = {
  project_id: projectIdSchema,
  entry_id: idSchema.describe('World entry UUID'),
  title: titleSchema.optional(),
  category: z.string().max(100).optional(),
  content: z.string().max(200_000).optional(),
  expected_updated_at: expectedUpdatedAtSchema
};

export const archiveWorldEntryInput = {
  project_id: projectIdSchema,
  entry_id: idSchema
};

// ===== Chapter =====
export const listChaptersInput = {
  project_id: projectIdSchema
};

export const getChapterInput = {
  project_id: projectIdSchema,
  chapter_id: idSchema.describe('Chapter UUID (from context chapter index)')
};

export const createChapterInput = {
  project_id: projectIdSchema,
  chapter_number: z.number().int().min(1).max(100_000).describe('Chapter number (must be unique among active chapters)'),
  title: titleSchema,
  content: z.string().min(1).max(2_000_000).describe('Full chapter text')
};

export const updateChapterInput = {
  project_id: projectIdSchema,
  chapter_id: idSchema,
  title: titleSchema.optional(),
  chapter_number: z.number().int().min(1).max(100_000).optional(),
  content: z.string().min(1).max(2_000_000).optional(),
  expected_updated_at: expectedUpdatedAtSchema
};

export const archiveChapterInput = {
  project_id: projectIdSchema,
  chapter_id: idSchema
};

// ===== Versions / Trash =====
export const listItemVersionsInput = {
  project_id: projectIdSchema,
  type: z.enum(['theme', 'character', 'timeline', 'world_entry', 'chapter']),
  id: idSchema
};

export const restoreItemVersionInput = {
  project_id: projectIdSchema,
  type: z.enum(['theme', 'character', 'timeline', 'world_entry', 'chapter']),
  id: idSchema,
  version_id: idSchema.describe('Version record UUID from list_item_versions')
};

export const listTrashInput = {
  project_id: projectIdSchema,
  type: z.enum(['character', 'timeline', 'world_entry', 'chapter'])
};

export const restoreItemInput = {
  project_id: projectIdSchema,
  type: z.enum(['character', 'timeline', 'world_entry', 'chapter']),
  id: idSchema
};

// ===== Export =====
export const exportManuscriptInput = {
  project_id: projectIdSchema,
  format: z.enum(['md', 'txt']).optional().describe('Export format (default md)')
};
