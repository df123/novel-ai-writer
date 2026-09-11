// MCP 工具：世界观条目写操作（底层 misc_records，MCP 对外叫 world_entry）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk } from '../result';
import { createWorldEntry, updateWorldEntry, archiveWorldEntry } from '../../services/domain/worldEntryService';
import {
  createWorldEntryInput,
  updateWorldEntryInput,
  archiveWorldEntryInput
} from '../schemas/entities';

const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export function registerWorldTools(server: McpServer): void {
  server.registerTool('create_world_entry', {
    title: 'Create world entry',
    description: 'Create a worldbuilding entry (city, sect, faction, magic system, item, etc.). Category is free-form text such as 城市/宗门/功法/物品.',
    inputSchema: createWorldEntryInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, title, category, content }) =>
    runTool('create_world_entry', project_id, () => {
      const entry = createWorldEntry(project_id, { title, category, content });
      return toolOk({ world_entry: entry }, `Created world entry "${entry.title}".`);
    })
  );

  server.registerTool('update_world_entry', {
    title: 'Update world entry',
    description: 'Update a world entry by UUID. A snapshot of the old state is saved automatically. Pass expected_updated_at from your last read.',
    inputSchema: updateWorldEntryInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, entry_id, title, category, content, expected_updated_at }) =>
    runTool('update_world_entry', project_id, () => {
      const entry = updateWorldEntry(
        entry_id,
        { title, category, content },
        { createVersion: true, expectedUpdatedAt: expected_updated_at },
        { projectId: project_id }
      );
      return toolOk({ world_entry: entry }, `Updated world entry "${entry.title}".`);
    })
  );

  server.registerTool('archive_world_entry', {
    title: 'Archive world entry',
    description: 'Soft-delete a world entry (recoverable via restore_item). Does not permanently destroy data.',
    inputSchema: archiveWorldEntryInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, entry_id }) =>
    runTool('archive_world_entry', project_id, () => {
      archiveWorldEntry(entry_id, { projectId: project_id });
      return toolOk({ archived: true }, 'World entry archived.');
    })
  );
}
