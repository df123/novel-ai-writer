// 数据格式化工具
import type {
  DbProject,
  Project,
  DbChat,
  Chat,
  DbMessage,
  Message,
  DbTimelineNode,
  TimelineNode,
  DbTimelineVersion,
  TimelineNodeVersion,
  DbCharacter,
  Character,
  DbCharacterVersion,
  CharacterVersion,
  ToolCall
} from '@shared/types';

/**
 * 解析 tool_calls JSON 字符串
 * @param toolCalls - tool_calls JSON 字符串
 * @returns 解析后的对象，失败返回 null
 */
export function parseToolCalls(toolCalls: string | null): ToolCall[] | null {
  if (!toolCalls) {
    return null;
  }
  try {
    return JSON.parse(toolCalls);
  } catch (e) {
    return null;
  }
}

/**
 * 格式化项目数据（数据库格式 -> 前端格式）
 * @param project - 数据库中的项目对象
 * @returns 格式化后的项目对象
 */
export function formatProject(project: DbProject): Project {
  return {
    id: project.id,
    title: project.name,
    description: project.description ?? undefined,
    createdAt: project.created_at,
    updatedAt: project.updated_at
  };
}

/**
 * 格式化聊天数据（数据库格式 -> 前端格式）
 * @param chat - 数据库中的聊天对象
 * @returns 格式化后的聊天对象
 */
export function formatChat(chat: DbChat): Chat {
  return {
    ...chat,
    title: chat.name,
    projectId: chat.project_id,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at
  };
}

/**
 * 格式化消息数据（数据库格式 -> 前端格式）
 * @param message - 数据库中的消息对象
 * @returns 格式化后的消息对象
 */
export function formatMessage(message: DbMessage): Message {
  const formatted: Message = {
    id: message.id,
    chatId: message.chat_id,
    role: message.role as 'system' | 'user' | 'assistant' | 'tool',
    content: message.content,
    reasoning_content: message.reasoning_content ?? undefined,
    tool_call_id: message.tool_call_id ?? undefined,
    timestamp: message.timestamp,
    orderIndex: message.order_index,
    deleted: message.deleted === 1,
    deletedAt: message.deleted_at ?? undefined,
    tool_calls: undefined
  };

  if (message.tool_calls) {
    formatted.tool_calls = parseToolCalls(message.tool_calls) ?? undefined;
  }

  return formatted;
}

/**
 * 格式化时间线节点数据（数据库格式 -> 前端格式）
 * @param node - 数据库中的时间线节点对象
 * @param parseTimelineContent - 解析时间线内容的函数
 * @returns 格式化后的时间线节点对象
 */
export function formatTimelineNode(
  node: DbTimelineNode,
  parseTimelineContent: (content: string) => { date: string; description: string }
): TimelineNode {
  const { date, description } = parseTimelineContent(node.content || '');
  return {
    id: node.id,
    projectId: node.project_id,
    title: node.title,
    date,
    description,
    content: node.content ?? undefined,
    orderIndex: node.order_index,
    createdAt: node.created_at
  };
}

/**
 * 格式化角色数据（数据库格式 -> 前端格式）
 * @param character - 数据库中的角色对象
 * @returns 格式化后的角色对象
 */
export function formatCharacter(character: DbCharacter): Character {
  return {
    ...character,
    avatar: character.avatar_url ?? undefined,
    projectId: character.project_id,
    createdAt: character.created_at,
    description: character.description ?? undefined,
    personality: character.personality ?? undefined,
    background: character.background ?? undefined,
    relationships: character.relationships ?? undefined
  };
}

/**
 * 格式化时间线版本数据（数据库格式 -> 前端格式）
 * @param version - 数据库中的时间线版本对象
 * @returns 格式化后的时间线版本对象
 */
export function formatTimelineVersion(version: DbTimelineVersion): TimelineNodeVersion {
  return {
    id: version.id,
    timelineNodeId: version.timeline_node_id,
    title: version.title,
    content: version.content || '',
    version: version.version,
    createdAt: version.created_at
  };
}

/**
 * 格式化角色版本数据（数据库格式 -> 前端格式）
 * @param version - 数据库中的角色版本对象
 * @returns 格式化后的角色版本对象
 */
export function formatCharacterVersion(version: DbCharacterVersion): CharacterVersion {
  return {
    ...version,
    characterId: version.character_id,
    avatar: version.avatar_url ?? undefined,
    createdAt: version.created_at,
    description: version.description ?? undefined,
    personality: version.personality ?? undefined,
    background: version.background ?? undefined,
    relationships: version.relationships ?? undefined
  };
}
