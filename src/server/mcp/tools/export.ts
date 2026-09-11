// MCP 工具：手稿导出（返回元数据 + 单次短期下载令牌，不把全文塞进 structuredContent）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk } from '../result';
import { listChapters } from '../../services/domain/chapterService';
import { exportChapters } from '../../services/exportService';
import { createDownload } from '../downloads';
import { exportManuscriptInput } from '../schemas/entities';

const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

export function registerExportTools(server: McpServer): void {
  server.registerTool('export_manuscript', {
    title: 'Export manuscript',
    description: 'Export all active chapters of a project as a single markdown/txt manuscript. Returns metadata plus a one-time download token (valid 10 minutes) — the full text is NOT embedded in the tool result.',
    inputSchema: exportManuscriptInput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id, format }) => runTool('export_manuscript', project_id, () => {
    const chapters = listChapters(project_id);
    if (chapters.length === 0) {
      return toolOk({ export: null }, 'No active chapters to export.');
    }
    const exportFormat = format ?? 'md';
    const result = exportChapters(chapters, exportFormat);
    const { token, expiresInSeconds } = createDownload(result.content, exportFormat === 'md' ? 'text/markdown' : 'text/plain', result.filename);
    return toolOk(
      {
        export: {
          filename: result.filename,
          mime_type: exportFormat === 'md' ? 'text/markdown' : 'text/plain',
          size: Buffer.byteLength(result.content, 'utf-8'),
          chapter_count: chapters.length,
          format: exportFormat,
          download_path: `/mcp/download/${token}`,
          download_token: token,
          expires_in_seconds: expiresInSeconds
        }
      },
      `Manuscript ready: ${result.filename}, ${chapters.length} chapters. Download within ${expiresInSeconds}s via GET /mcp/download/${token} (one-time token).`
    );
  }));
}
