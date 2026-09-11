// MCP 工具：章节读写（更新自动写入 chapter_versions 快照）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk, summarizeList } from '../result';
import {
  listChapters,
  getChapter,
  createChapter,
  updateChapter,
  archiveChapter
} from '../../services/domain/chapterService';
import {
  listChaptersInput,
  getChapterInput,
  createChapterInput,
  updateChapterInput,
  archiveChapterInput
} from '../schemas/entities';

const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export function registerChapterTools(server: McpServer): void {
  server.registerTool('list_chapters', {
    title: 'List chapters',
    description: 'List all active chapters of a project (index only: id, number, title, updated_at). Use get_chapter for full text.',
    inputSchema: listChaptersInput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id }) => runTool('list_chapters', project_id, () => {
    const chapters = listChapters(project_id);
    const index = chapters.map(c => ({
      id: c.id,
      chapter_number: c.chapterNumber,
      title: c.title,
      updated_at: c.updatedAt
    }));
    return toolOk({ chapters: index }, summarizeList(chapters, 'chapters'));
  }));

  server.registerTool('get_chapter', {
    title: 'Get chapter',
    description: 'Read one chapter with full text by UUID.',
    inputSchema: getChapterInput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id, chapter_id }) => runTool('get_chapter', project_id, () => {
    const chapter = getChapter(project_id, chapter_id);
    return toolOk({ chapter }, `Chapter ${chapter.chapterNumber} "${chapter.title}" (${chapter.content.length} chars).`);
  }));

  server.registerTool('create_chapter', {
    title: 'Create chapter',
    description: 'Save a new chapter with full text. Only call after the user explicitly approves saving (e.g. "保存成第38章"). Drafts discussed in chat must NOT be saved automatically.',
    inputSchema: createChapterInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, chapter_number, title, content }) =>
    runTool('create_chapter', project_id, () => {
      const chapter = createChapter(project_id, { chapterNumber: chapter_number, title, content });
      return toolOk({ chapter }, `Saved chapter ${chapter.chapterNumber} "${chapter.title}".`);
    })
  );

  server.registerTool('update_chapter', {
    title: 'Update chapter',
    description: 'Update an existing chapter by UUID. A snapshot of the old state is saved automatically. Pass expected_updated_at from your last read.',
    inputSchema: updateChapterInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, chapter_id, title, chapter_number, content, expected_updated_at }) =>
    runTool('update_chapter', project_id, () => {
      const chapter = updateChapter(
        project_id,
        chapter_id,
        { title, chapterNumber: chapter_number, content },
        { expectedUpdatedAt: expected_updated_at }
      );
      return toolOk({ chapter }, `Updated chapter ${chapter.chapterNumber} "${chapter.title}".`);
    })
  );

  server.registerTool('archive_chapter', {
    title: 'Archive chapter',
    description: 'Soft-delete a chapter (recoverable via restore_item). Does not permanently destroy data.',
    inputSchema: archiveChapterInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, chapter_id }) =>
    runTool('archive_chapter', project_id, () => {
      archiveChapter(project_id, chapter_id);
      return toolOk({ archived: true }, 'Chapter archived.');
    })
  );
}
