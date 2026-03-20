// 导出服务
import { query } from '../db';
import type { DbProject, DbChat, DbTimelineNode, DbCharacter, DbMessage } from '../../shared/types';
import type { ExportResult } from '../types/service.types';

/**
 * 导出项目数据
 * @param projectId - 项目 ID
 * @param format - 导出格式（md 或 txt）
 * @returns 包含 content 字段的对象
 * @throws {Error} 当项目不存在时抛出错误
 */
export function exportProject(projectId: string, format: 'md' | 'txt'): ExportResult {
  const projects = query<DbProject>('SELECT * FROM projects WHERE id = ?', [projectId]);
  const project = projects[0];

  if (!project) {
    throw new Error('项目不存在');
  }

  const chats = query<DbChat>('SELECT * FROM chats WHERE project_id = ?', [projectId]);
  const timeline = query<DbTimelineNode>(
    'SELECT * FROM timeline_nodes WHERE project_id = ? ORDER BY order_index ASC',
    [projectId]
  );
  const characters = query<DbCharacter>('SELECT * FROM characters WHERE project_id = ?', [projectId]);

  // 一次性查询所有 messages，避免 N+1 查询问题
  const chatIds = chats.map(c => c.id);
  const messages = chatIds.length > 0
    ? query<DbMessage>(
      `SELECT * FROM messages WHERE chat_id IN (${chatIds.map(() => '?').join(',')}) ORDER BY timestamp ASC`,
      chatIds
    )
    : [];

  // 将 messages 按 chat_id 分组
  const messagesByChat: Record<string, DbMessage[]> = {};
  messages.forEach(msg => {
    if (!messagesByChat[msg.chat_id]) {
      messagesByChat[msg.chat_id] = [];
    }
    messagesByChat[msg.chat_id].push(msg);
  });

  let content = '';

  if (format === 'md') {
    content = exportMarkdown(project, chats, timeline, characters, messagesByChat);
  } else {
    content = exportText(project, chats, timeline, characters, messagesByChat);
  }

  return {
    content,
    contentType: format === 'md' ? 'text/markdown' : 'text/plain',
    filename: `${project.name}.${format}`,
    size: Buffer.byteLength(content, 'utf-8')
  };
}

/**
 * 导出为 Markdown 格式
 * @param project - 项目对象
 * @param chats - 聊天数组
 * @param timeline - 时间线节点数组
 * @param characters - 角色数组
 * @param messagesByChat - 按 chat_id 分组的消息对象
 * @returns Markdown 格式的导出内容
 */
function exportMarkdown(
  project: DbProject,
  chats: DbChat[],
  timeline: DbTimelineNode[],
  characters: DbCharacter[],
  messagesByChat: Record<string, DbMessage[]>
): string {
  let content = '';

  content += `# ${project.name}\n\n`;
  if (project.description) {
    content += `${project.description}\n\n`;
  }

  content += `## 时间线\n\n`;
  for (const node of timeline) {
    content += `### ${node.title}\n\n`;
    if (node.content) {
      content += `${node.content}\n\n`;
    }
  }

  content += `## 角色\n\n`;
  for (const char of characters) {
    content += `### ${char.name}\n\n`;
    if (char.description) {
      content += `简介：${char.description}\n\n`;
    }
    if (char.personality) {
      content += `性格：${char.personality}\n\n`;
    }
    if (char.background) {
      content += `背景：${char.background}\n\n`;
    }
  }

  content += `## 聊天记录\n\n`;
  for (const chat of chats) {
    content += `### ${chat.name}\n\n`;
    const chatMessages = messagesByChat[chat.id] || [];
    for (const msg of chatMessages) {
      content += `**${msg.role}**：${msg.content}\n\n`;
    }
  }

  return content;
}

/**
 * 导出为纯文本格式
 * @param project - 项目对象
 * @param chats - 聊天数组
 * @param timeline - 时间线节点数组
 * @param characters - 角色数组
 * @param messagesByChat - 按 chat_id 分组的消息对象
 * @returns 纯文本格式的导出内容
 */
function exportText(
  project: DbProject,
  chats: DbChat[],
  timeline: DbTimelineNode[],
  characters: DbCharacter[],
  messagesByChat: Record<string, DbMessage[]>
): string {
  let content = '';

  content += `${project.name}\n${'='.repeat(project.name.length)}\n\n`;
  if (project.description) {
    content += `${project.description}\n\n`;
  }

  content += `时间线\n${'-'.repeat(20)}\n\n`;
  for (const node of timeline) {
    content += `${node.title}\n${'.'.repeat(node.title.length)}\n`;
    if (node.content) {
      content += `${node.content}\n`;
    }
    content += '\n';
  }

  content += `角色\n${'-'.repeat(20)}\n\n`;
  for (const char of characters) {
    content += `${char.name}\n${'.'.repeat(char.name.length)}\n`;
    if (char.description) {
      content += `简介：${char.description}\n`;
    }
    if (char.personality) {
      content += `性格：${char.personality}\n`;
    }
    if (char.background) {
      content += `背景：${char.background}\n`;
    }
    content += '\n';
  }

  content += `聊天记录\n${'-'.repeat(20)}\n\n`;
  for (const chat of chats) {
    content += `${chat.name}\n${'.'.repeat(chat.name.length)}\n`;
    const chatMessages = messagesByChat[chat.id] || [];
    for (const msg of chatMessages) {
      content += `[${msg.role}]：${msg.content}\n\n`;
    }
  }

  return content;
}
