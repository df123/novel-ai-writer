// MCP 工具：版本历史与回收站（第二阶段能力；不提供永久删除）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk, summarizeList, toMcpTimelineEvent } from '../result';
import { listItemVersions, restoreItemVersion, listTrash, restoreItem } from '../../services/domain/storyItemService';
import type { StoryItemType } from '../../services/domain/storySearchService';
import type { TimelineNode } from '@shared/types';
import {
  listItemVersionsInput,
  restoreItemVersionInput,
  listTrashInput,
  restoreItemInput
} from '../schemas/entities';
import { versionsOutput, trashOutput, restoredItemOutput } from '../schemas/output';

const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

/** timeline 实体经 MCP 输出前剥离 legacy description 别名,其余类型原样 */
function adaptMcpEntity(type: StoryItemType, item: unknown): unknown {
  return type === 'timeline' ? toMcpTimelineEvent(item as TimelineNode) : item;
}

export function registerVersionTools(server: McpServer): void {
  server.registerTool('list_item_versions', {
    title: 'List item versions',
    description: 'List saved version snapshots of one entity (theme/character/timeline/world_entry/chapter). Chapter/theme snapshots include full old content.',
    inputSchema: listItemVersionsInput,
    outputSchema: versionsOutput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id, type, id }) => runTool('list_item_versions', project_id, () => {
    const versions = listItemVersions(project_id, type as StoryItemType, id) as Array<{ version?: number }>;
    return toolOk({ versions }, `${versions.length} versions found.`);
  }));

  server.registerTool('restore_item_version', {
    title: 'Restore item version',
    description: 'Restore an entity to a previous version. The current state is snapshotted first, so restoring is itself reversible.',
    inputSchema: restoreItemVersionInput,
    outputSchema: restoredItemOutput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, type, id, version_id }) =>
    runTool('restore_item_version', project_id, () => {
      const restored = restoreItemVersion(project_id, type as StoryItemType, id, version_id);
      return toolOk({ restored_item: adaptMcpEntity(type as StoryItemType, restored) }, `Restored ${type} to the selected version.`);
    })
  );

  server.registerTool('list_trash', {
    title: 'List trash',
    description: 'List archived (soft-deleted) entities of a project by type. Theme has no trash list.',
    inputSchema: listTrashInput,
    outputSchema: trashOutput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id, type }) => runTool('list_trash', project_id, () => {
    const raw = listTrash(project_id, type as StoryItemType) as Array<{ id?: string; title?: string; name?: string }>;
    const items = raw.map(item => adaptMcpEntity(type as StoryItemType, item)) as Array<{ id?: string; title?: string; name?: string }>;
    return toolOk({ items }, summarizeList(items, `${type} items in trash`));
  }));

  server.registerTool('restore_item', {
    title: 'Restore item',
    description: 'Restore an archived entity from trash back to active state.',
    inputSchema: restoreItemInput,
    outputSchema: restoredItemOutput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, type, id }) =>
    runTool('restore_item', project_id, () => {
      const restored = restoreItem(project_id, type as StoryItemType, id);
      return toolOk({ restored_item: adaptMcpEntity(type as StoryItemType, restored) }, `Restored ${type} from trash.`);
    })
  );
}
