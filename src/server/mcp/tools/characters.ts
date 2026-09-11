// MCP 工具：角色写操作（更新自动快照，归档为软删除）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk } from '../result';
import { createCharacter, updateCharacter, archiveCharacter } from '../../services/domain/characterService';
import {
  createCharacterInput,
  updateCharacterInput,
  archiveCharacterInput
} from '../schemas/entities';

const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export function registerCharacterTools(server: McpServer): void {
  server.registerTool('create_character', {
    title: 'Create character',
    description: 'Create a character in a project with name and optional personality/background/relationships.',
    inputSchema: createCharacterInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, name, personality, background, relationships }) =>
    runTool('create_character', project_id, () => {
      const character = createCharacter(project_id, { name, personality, background, relationships });
      return toolOk({ character }, `Created character "${character.name}".`);
    })
  );

  server.registerTool('update_character', {
    title: 'Update character',
    description: 'Update a character by UUID (do NOT guess by name — resolve the ID via search_story/get_story_context first). A snapshot of the old state is saved automatically. Pass expected_updated_at from your last read.',
    inputSchema: updateCharacterInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, character_id, name, personality, background, relationships, expected_updated_at }) =>
    runTool('update_character', project_id, () => {
      const character = updateCharacter(
        character_id,
        { name, personality, background, relationships },
        { createVersion: true, expectedUpdatedAt: expected_updated_at },
        { projectId: project_id }
      );
      return toolOk({ character }, `Updated character "${character.name}".`);
    })
  );

  server.registerTool('archive_character', {
    title: 'Archive character',
    description: 'Soft-delete a character (recoverable via restore_item). Does not permanently destroy data.',
    inputSchema: archiveCharacterInput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, character_id }) =>
    runTool('archive_character', project_id, () => {
      archiveCharacter(character_id, { projectId: project_id });
      return toolOk({ archived: true }, 'Character archived.');
    })
  );
}
