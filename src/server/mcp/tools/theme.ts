// MCP 工具：主旨读写（每项目单例，更新自动写历史快照）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk } from '../result';
import { getThemeByProject, upsertTheme } from '../../services/domain/themeService';
import { getThemeInput, upsertThemeInput } from '../schemas/entities';

const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export function registerThemeTools(server: McpServer): void {
  server.registerTool('get_theme', {
    title: 'Get theme',
    description: 'Get the current premise/theme of a project (one per project). Returns null if not set.',
    inputSchema: getThemeInput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id }) => runTool('get_theme', project_id, () => {
    const theme = getThemeByProject(project_id);
    if (!theme) {
      return toolOk({ theme: null }, 'No theme set for this project yet.');
    }
    return toolOk({ theme }, `Theme "${theme.title}" (version ${theme.version}).`);
  }));

  server.registerTool('upsert_theme', {
    title: 'Upsert theme',
    description: 'Create the project theme if absent, or update it (a history snapshot of the old content is saved automatically). Pass expected_updated_at from your last read when updating.',
    inputSchema: upsertThemeInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, title, content, expected_updated_at }) =>
    runTool('upsert_theme', project_id, () => {
      const theme = upsertTheme(project_id, { title, content, createdBy: 'llm' }, { expectedUpdatedAt: expected_updated_at });
      return toolOk({ theme }, `Theme "${theme.title}" saved (version ${theme.version}).`);
    })
  );
}
