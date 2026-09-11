// MCP Server 指令：短且明确，不写大型 system prompt
export const MCP_SERVER_NAME = 'novel-ai-writer';
export const MCP_SERVER_VERSION = '1.0.0';

export const MCP_SERVER_INSTRUCTIONS = `This server manages structured novel data. Always resolve a project first (list_projects, then pass project_id to every other tool). Never assume a global current project. Read current data (get_story_context or get_story_item) before modifying an existing entity, and pass expected_updated_at to avoid overwriting concurrent changes. Updates create history snapshots automatically. Chats, messages, voice, research and illustration generation are not MCP capabilities.`;
