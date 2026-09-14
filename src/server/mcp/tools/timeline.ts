// MCP 工具：时间线事件写操作（更新自动快照，归档为软删除）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk } from '../result';
import {
  createTimelineEvent,
  updateTimelineEvent,
  archiveTimelineEvent
} from '../../services/domain/timelineService';
import {
  createTimelineEventInput,
  updateTimelineEventInput,
  archiveTimelineEventInput
} from '../schemas/entities';
import { timelineEventToolOutput, archivedOutput } from '../schemas/output';

const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export function registerTimelineTools(server: McpServer): void {
  server.registerTool('create_timeline_event', {
    title: 'Create timeline event',
    description: 'Create a timeline event (plot point) in a project. Write the body text into content; the description field in outputs is only a legacy alias of content with identical value.',
    inputSchema: createTimelineEventInput,
    outputSchema: timelineEventToolOutput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, title, date, content, order_index }) =>
    runTool('create_timeline_event', project_id, () => {
      const event = createTimelineEvent(project_id, { title, date, content, orderIndex: order_index });
      return toolOk({ timeline_event: event }, `Created timeline event "${event.title}".`);
    })
  );

  server.registerTool('update_timeline_event', {
    title: 'Update timeline event',
    description: 'Update a timeline event by UUID. A snapshot of the old state is saved automatically. Pass expected_updated_at from your last read (the updatedAt field of the entity). Update the body via content.',
    inputSchema: updateTimelineEventInput,
    outputSchema: timelineEventToolOutput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, event_id, title, date, content, order_index, expected_updated_at }) =>
    runTool('update_timeline_event', project_id, () => {
      const event = updateTimelineEvent(
        event_id,
        { title, date, content, orderIndex: order_index },
        { createVersion: true, expectedUpdatedAt: expected_updated_at },
        { projectId: project_id }
      );
      return toolOk({ timeline_event: event }, `Updated timeline event "${event.title}".`);
    })
  );

  server.registerTool('archive_timeline_event', {
    title: 'Archive timeline event',
    description: 'Soft-delete a timeline event (recoverable via restore_item). Does not permanently destroy data.',
    inputSchema: archiveTimelineEventInput,
    outputSchema: archivedOutput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, event_id }) =>
    runTool('archive_timeline_event', project_id, () => {
      archiveTimelineEvent(event_id, { projectId: project_id });
      return toolOk({ archived: true }, 'Timeline event archived.');
    })
  );
}
