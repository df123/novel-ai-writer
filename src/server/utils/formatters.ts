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
  DbChapter,
  Chapter,
  DbTheme,
  Theme,
  DbThemeHistory,
  ThemeHistory,
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
 * @returns 格式化后的时间线节点对象
 */
export function formatTimelineNode(node: DbTimelineNode): TimelineNode {
  return {
    id: node.id,
    projectId: node.project_id,
    title: node.title,
    date: node.date || '',
    description: node.content || '',
    content: node.content ?? undefined,
    orderIndex: node.order_index,
    createdAt: node.created_at,
    deleted: node.deleted === 1,
    deletedAt: node.deleted_at ?? undefined
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
    projectId: character.project_id,
    createdAt: character.created_at,
    personality: character.personality ?? undefined,
    background: character.background ?? undefined,
    relationships: character.relationships ?? undefined,
    deleted: character.deleted === 1,
    deletedAt: character.deleted_at ?? undefined
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
    date: version.date || '',
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
    createdAt: version.created_at,
    personality: version.personality ?? undefined,
    background: version.background ?? undefined,
    relationships: version.relationships ?? undefined
  };
}

/**
 * 格式化章节数据（数据库格式 -> 前端格式）
 * @param chapter - 数据库中的章节对象
 * @returns 格式化后的章节对象
 */
export function formatChapter(chapter: DbChapter): Chapter {
  return {
    id: chapter.id,
    projectId: chapter.project_id,
    chapterNumber: chapter.chapter_number,
    title: chapter.title,
    content: chapter.content,
    sourceMessageId: chapter.source_message_id ?? undefined,
    createdAt: chapter.created_at,
    updatedAt: chapter.updated_at,
    deleted: chapter.deleted === 1,
    deletedAt: chapter.deleted_at ?? undefined
  };
}

/**
 * 格式化主旨数据（数据库格式 -> 前端格式）
 * @param theme - 数据库中的主旨对象
 * @returns 格式化后的主旨对象
 */
export function formatTheme(theme: DbTheme): Theme {
  return {
    id: theme.id,
    projectId: theme.project_id,
    title: theme.title,
    content: theme.content,
    version: theme.version,
    createdBy: theme.created_by as 'user' | 'llm',
    createdAt: theme.created_at,
    updatedAt: theme.updated_at,
    deleted: theme.deleted === 1,
    deletedAt: theme.deleted_at ?? undefined
  };
}

/**
 * 格式化主旨历史记录数据（数据库格式 -> 前端格式）
 * @param history - 数据库中的主旨历史记录对象
 * @returns 格式化后的主旨历史记录对象
 */
export function formatThemeHistory(history: DbThemeHistory): ThemeHistory {
  return {
    id: history.id,
    themeId: history.theme_id,
    content: history.content,
    version: history.version,
    createdBy: history.created_by as 'user' | 'llm',
    createdAt: history.created_at
  };
}
