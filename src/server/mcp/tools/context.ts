// MCP 工具：故事上下文/搜索/条目读取——整个 MCP 最重要的一组只读工具
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk, summarizeList } from '../result';
import { getStoryContext } from '../../services/domain/storyContextService';
import { searchStory, type StoryItemType } from '../../services/domain/storySearchService';
import { getStoryItem } from '../../services/domain/storyItemService';
import { getStoryContextInput, searchStoryInput, getStoryItemInput } from '../schemas/entities';
import { storyContextOutput, searchStoryOutput, storyItemOutput } from '../schemas/output';

const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

export function registerContextTools(server: McpServer): void {
  server.registerTool('get_story_context', {
    title: 'Get story context',
    description: 'Get the structured story context of a project: premise (theme), characters, timeline, world entries and a chapter index. Chapter full text is NOT included — use get_chapter for content. World entries contain a short summary only — use get_story_item for full content. Use this before writing or editing.',
    inputSchema: getStoryContextInput,
    outputSchema: storyContextOutput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id }) => runTool('get_story_context', project_id, () => {
    const context = getStoryContext(project_id);
    const summary = `Context of "${context.project.title}": ${context.characters.length} characters, ${context.timeline.length} timeline events, ${context.world_entries.length} world entries, ${context.chapters.length} chapters${context.theme ? ', theme present' : ', no theme yet'}${context.truncated ? ' (truncated)' : ''}.`;
    return toolOk({ ...context }, summary);
  }));

  server.registerTool('search_story', {
    title: 'Search story',
    description: 'Keyword search across characters, timeline, world entries, theme and chapter text. Returns matching entity IDs with snippets. Use it to locate entities before reading or updating them.',
    inputSchema: searchStoryInput,
    outputSchema: searchStoryOutput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id, query, types, limit }) => runTool('search_story', project_id, () => {
    const { results } = searchStory(project_id, query, types as StoryItemType[] | undefined, limit);
    return toolOk({ results }, summarizeList(results, 'matches'));
  }));

  server.registerTool('get_story_item', {
    title: 'Get story item',
    description: 'Read one full entity (theme/character/timeline/world_entry/chapter) by UUID. The item must belong to the given project. Returns the complete record including updated_at for concurrency-safe updates.',
    inputSchema: getStoryItemInput,
    outputSchema: storyItemOutput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id, type, id }) => runTool('get_story_item', project_id, () => {
    const item = getStoryItem(project_id, type, id);
    const label = item.theme?.title || item.character?.name || item.timeline_event?.title || item.world_entry?.title ||
      (item.chapter ? `第${item.chapter.chapterNumber}章 ${item.chapter.title}` : 'item');
    return toolOk({ ...item }, `Retrieved ${type} "${label}".`);
  }));
}
