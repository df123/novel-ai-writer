// MCP 工具输出 schema:与各工具 structuredContent 实际形状一一对应
// zod 默认(strip)模式下额外字段不阻断校验,但声明的字段必须存在且类型正确
import { z } from 'zod';

const ts = z.number().describe('Unix seconds');
const storyItemType = z.enum(['theme', 'character', 'timeline', 'world_entry', 'chapter']);

// ===== 实体 =====
export const projectOutput = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  createdAt: ts,
  updatedAt: ts
});

export const themeOutput = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  content: z.string(),
  version: z.number(),
  createdBy: z.string(),
  createdAt: ts,
  updatedAt: ts,
  deleted: z.boolean().optional(),
  deletedAt: ts.optional()
});

export const timelineEventOutput = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  date: z.string(),
  description: z.string(),
  content: z.string().optional(),
  orderIndex: z.number(),
  createdAt: ts,
  updatedAt: ts,
  deleted: z.boolean().optional(),
  deletedAt: ts.optional()
});

export const characterOutput = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  personality: z.string().optional(),
  background: z.string().optional(),
  relationships: z.string().optional(),
  createdAt: ts,
  updatedAt: ts,
  deleted: z.boolean().optional(),
  deletedAt: ts.optional()
});

export const worldEntryOutput = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  category: z.string(),
  content: z.string(),
  orderIndex: z.number(),
  createdAt: ts,
  updatedAt: ts,
  deleted: z.boolean().optional(),
  deletedAt: ts.optional()
});

export const chapterOutput = z.object({
  id: z.string(),
  projectId: z.string(),
  chapterNumber: z.number(),
  title: z.string(),
  content: z.string(),
  sourceMessageId: z.string().optional(),
  createdAt: ts,
  updatedAt: ts,
  deleted: z.boolean().optional(),
  deletedAt: ts.optional()
});

// ===== 工具输出形状(registerTool outputSchema 使用的 raw shape) =====
export const listProjectsOutput = { projects: z.array(projectOutput) };
export const projectByIdOutput = { project: projectOutput };

export const storyContextOutput = {
  project: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    updated_at: ts
  }),
  theme: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    version: z.number(),
    updated_at: ts
  }).nullable(),
  characters: z.array(z.object({
    id: z.string(),
    name: z.string(),
    personality: z.string(),
    background: z.string(),
    relationships: z.string(),
    updated_at: ts
  })),
  timeline: z.array(z.object({
    id: z.string(),
    date: z.string(),
    title: z.string(),
    content: z.string(),
    updated_at: ts
  })),
  world_entries: z.array(z.object({
    id: z.string(),
    category: z.string(),
    title: z.string(),
    summary: z.string(),
    updated_at: ts
  })),
  chapters: z.array(z.object({
    id: z.string(),
    chapter_number: z.number(),
    title: z.string(),
    updated_at: ts
  })),
  truncated: z.boolean(),
  truncated_note: z.string().nullable()
};

export const searchStoryOutput = {
  results: z.array(z.object({
    type: storyItemType,
    id: z.string(),
    title: z.string(),
    snippet: z.string()
  }))
};

export const storyItemOutput = {
  type: storyItemType,
  theme: themeOutput.optional(),
  character: characterOutput.optional(),
  timeline_event: timelineEventOutput.optional(),
  world_entry: worldEntryOutput.optional(),
  chapter: chapterOutput.optional()
};

export const getThemeOutput = { theme: themeOutput.nullable() };
export const upsertThemeOutput = { theme: themeOutput };
export const timelineEventToolOutput = { timeline_event: timelineEventOutput };
export const characterToolOutput = { character: characterOutput };
export const worldEntryToolOutput = { world_entry: worldEntryOutput };
export const chapterToolOutput = { chapter: chapterOutput };
export const archivedOutput = { archived: z.literal(true) };

export const listChaptersOutput = {
  chapters: z.array(z.object({
    id: z.string(),
    chapter_number: z.number(),
    title: z.string(),
    updated_at: ts
  }))
};

// 版本快照/回收站条目按实体类型形状各异,统一为对象数组
const recordSchema = z.record(z.string(), z.unknown());
export const versionsOutput = { versions: z.array(recordSchema) };
export const trashOutput = { items: z.array(recordSchema) };
export const restoredItemOutput = { restored_item: recordSchema };

export const exportManuscriptOutput = {
  export: z.object({
    filename: z.string(),
    mime_type: z.string(),
    size: z.number(),
    chapter_count: z.number(),
    format: z.enum(['md', 'txt']),
    download_path: z.string(),
    download_token: z.string(),
    expires_in_seconds: z.number()
  }).nullable()
};
