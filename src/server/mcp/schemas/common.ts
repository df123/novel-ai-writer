// MCP 工具通用 schema 片段
import { z } from 'zod';

/** 项目 ID（UUID），除 list_projects/get_project 外所有工具必填 */
export const projectIdSchema = z.string().uuid().describe('Project UUID from list_projects');

/** 实体 ID（UUID） */
export const idSchema = z.string().uuid().describe('Entity UUID');

/** 乐观并发检查：上次读取时的 updated_at（Unix 秒） */
export const expectedUpdatedAtSchema = z.number().int().positive().optional().describe(
  "The entity's updatedAt value (camelCase field on entities) from your last read. If the server has a newer value the update is rejected with CONFLICT and you must re-read."
);

/** 列表数量上限 */
export const limitSchema = z.number().int().min(1).max(100).optional().describe('Max results (1-100, default 20)');

/** 标题 */
export const titleSchema = z.string().min(1).max(300).describe('Title (1-300 chars)');

/** 长文本（人物性格/背景/正文等） */
export const longTextSchema = (max: number) => z.string().max(max);
