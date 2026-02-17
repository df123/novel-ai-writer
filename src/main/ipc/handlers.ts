import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { getDatabase } from '../database';
import { generateId } from '../../shared/utils';
import { Project, Chat, TimelineNode, Character, Message } from '../../shared/types';
import { llmService } from '../llm';
import { templateEngine } from '../../shared/templateEngine';

export function registerIPCHandlers(): void {
  registerProjectHandlers();
  registerChatHandlers();
  registerTimelineHandlers();
  registerCharacterHandlers();
  registerExportHandlers();
  registerSettingsHandlers();
}

function registerProjectHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT.CREATE, async (_, project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const db = await getDatabase();
    const now = Date.now();
    const newProject: Project = {
      id: generateId(),
      ...project,
      createdAt: now,
      updatedAt: now,
    };

    db.run(`
      INSERT INTO projects (id, title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [newProject.id, newProject.title, newProject.description || '', newProject.createdAt, newProject.updatedAt]);

    return newProject;
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT.GET, async (_, id: string) => {
    const db = await getDatabase();
    const result = db.exec(`SELECT * FROM projects WHERE id = '${id}'`);
    
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: row[0],
      title: row[1],
      description: row[2],
      createdAt: row[3],
      updatedAt: row[4],
    };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT.GET_ALL, async () => {
    const db = await getDatabase();
    const result = db.exec('SELECT * FROM projects ORDER BY updated_at DESC');
    
    if (result.length === 0) return [];

    return result[0].values.map((row: any[]) => ({
      id: row[0],
      title: row[1],
      description: row[2],
      createdAt: row[3],
      updatedAt: row[4],
    }));
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT.UPDATE, async (_, id: string, updates: Partial<Project>) => {
    const db = await getDatabase();
    const now = Date.now();
    
    db.run(`
      UPDATE projects 
      SET title = ?, description = ?, updated_at = ?
      WHERE id = ?
    `, [updates.title, updates.description || '', now, id]);

    return getProjectById(db, id);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT.DELETE, async (_, id: string) => {
    const db = await getDatabase();
    db.run(`DELETE FROM projects WHERE id = '${id}'`);
  });
}

function registerChatHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CHAT.CREATE, async (_, chat: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>) => {
    const db = await getDatabase();
    const now = Date.now();
    const newChat: Chat = {
      id: generateId(),
      ...chat,
      createdAt: now,
      updatedAt: now,
    };

    db.run(`
      INSERT INTO chats (id, project_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [newChat.id, newChat.projectId, newChat.title, newChat.createdAt, newChat.updatedAt]);

    return newChat;
  });

  ipcMain.handle(IPC_CHANNELS.CHAT.GET_ALL, async (_, projectId: string) => {
    const db = await getDatabase();
    const result = db.exec(`SELECT * FROM chats WHERE project_id = '${projectId}' ORDER BY updated_at DESC`);
    
    if (result.length === 0) return [];

    return result[0].values.map((row: any[]) => ({
      id: row[0],
      projectId: row[1],
      title: row[2],
      createdAt: row[3],
      updatedAt: row[4],
    }));
  });

  ipcMain.handle(IPC_CHANNELS.CHAT.GET_MESSAGES, async (_, chatId: string) => {
    const db = await getDatabase();
    const result = db.exec(`
      SELECT * FROM messages 
      WHERE chat_id = '${chatId}' AND deleted = 0 
      ORDER BY order_index ASC
    `);

    if (result.length === 0) return [];

    return result[0].values.map((row: any[]) => ({
      id: row[0],
      chatId: row[1],
      role: row[2],
      content: row[3],
      timestamp: row[4],
      orderIndex: row[6],
    }));
  });

  ipcMain.handle(IPC_CHANNELS.CHAT.SEND_MESSAGE, async (event, { 
    chatId, 
    content, 
    role, 
    systemPrompt,
    providerName,
    modelName,
    timelineId,
    characterIds,
  }: any) => {
    const db = await getDatabase();
    const userMessage: Message = {
      id: generateId(),
      chatId,
      role,
      content,
      timestamp: Date.now(),
      orderIndex: getNextOrderIndex(db, chatId),
    };

    db.run(`
      INSERT INTO messages (id, chat_id, role, content, timestamp, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userMessage.id, userMessage.chatId, userMessage.role, userMessage.content, userMessage.timestamp, userMessage.orderIndex]);

    event.sender.send('chat:message-sent', userMessage);

    try {
      const result = db.exec(`
        SELECT * FROM messages 
        WHERE chat_id = '${chatId}' AND deleted = 0 
        ORDER BY order_index ASC
      `);

      const messages = result[0]?.values.map((row: any[]) => ({
        role: row[2],
        content: row[3],
      })) || [];

      let finalSystemPrompt = systemPrompt;
      
      if (timelineId) {
        const timelineResult = db.exec(`SELECT * FROM timeline_nodes WHERE id = '${timelineId}'`);
        let timeline: any = null;
        let characters: any[] = [];
        
        if (timelineResult.length > 0 && timelineResult[0].values.length > 0) {
          const timelineRow = timelineResult[0].values[0];
          timeline = {
            id: timelineRow[0],
            projectId: timelineRow[1],
            title: timelineRow[2],
            date: timelineRow[3],
            description: timelineRow[4],
          };
        }
        
        if (characterIds && characterIds.length > 0) {
          const placeholders = characterIds.map((id: string) => `'${id}'`).join(',');
          const charResult = db.exec(`SELECT * FROM characters WHERE id IN (${placeholders})`);
          if (charResult.length > 0) {
            characters = charResult[0].values.map((row: any[]) => ({
              id: row[0],
              name: row[2],
              personality: row[4],
            }));
          }
        }
        
        const contextPrompt = templateEngine.buildContextPrompt(timeline, characters);
        if (contextPrompt) {
          finalSystemPrompt = `${systemPrompt}\n\n${contextPrompt}`;
        }
      }

      const chatOptions = {
        model: modelName,
        temperature: 0.7,
      };

      const stream = await llmService.chat(providerName, messages, chatOptions);

      let assistantContent = '';
      
      for await (const chunk of stream) {
        assistantContent += chunk;
        event.sender.send('chat:stream', { chunk, messageId: userMessage.id });
      }

      const assistantMessage: Message = {
        id: generateId(),
        chatId,
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
        orderIndex: getNextOrderIndex(db, chatId),
      };

      db.run(`
        INSERT INTO messages (id, chat_id, role, content, timestamp, order_index)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [assistantMessage.id, assistantMessage.chatId, assistantMessage.role, assistantMessage.content, assistantMessage.timestamp, assistantMessage.orderIndex]);

      event.sender.send('chat:message-complete', assistantMessage);

      return assistantMessage;
    } catch (error) {
      console.error('Send message error:', error);
      event.sender.send('chat:error', { error: (error as Error).message });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHAT.DELETE_MESSAGE, async (_, messageId: string) => {
    const db = await getDatabase();
    db.run(`
      UPDATE messages 
      SET deleted = 1, deleted_at = ?
      WHERE id = '${messageId}'
    `, [Date.now()]);
  });

  ipcMain.handle(IPC_CHANNELS.CHAT.CLEAR_HISTORY, async (_, chatId: string) => {
    const db = await getDatabase();
    db.run(`
      UPDATE messages 
      SET deleted = 1, deleted_at = ?
      WHERE chat_id = '${chatId}'
    `, [Date.now()]);
  });
}

function registerTimelineHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TIMELINE.CREATE, async (_, projectId: string, node: Omit<TimelineNode, 'id' | 'projectId' | 'createdAt' | 'orderIndex'>) => {
    const db = await getDatabase();
    const orderIndex = getNextTimelineOrderIndex(db, projectId);
    const newNode: TimelineNode = {
      id: generateId(),
      projectId,
      ...node,
      orderIndex,
      createdAt: Date.now(),
    };

    db.run(`
      INSERT INTO timeline_nodes (id, project_id, title, date, description, order_index, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [newNode.id, newNode.projectId, newNode.title, newNode.date, newNode.description || '', newNode.orderIndex, newNode.createdAt]);

    return newNode;
  });

  ipcMain.handle(IPC_CHANNELS.TIMELINE.GET_ALL, async (_, projectId: string) => {
    const db = await getDatabase();
    const result = db.exec(`SELECT * FROM timeline_nodes WHERE project_id = '${projectId}' ORDER BY order_index ASC`);
    
    if (result.length === 0) return [];

    return result[0].values.map((row: any[]) => ({
      id: row[0],
      projectId: row[1],
      title: row[2],
      date: row[3],
      description: row[4],
      orderIndex: row[5],
      createdAt: row[6],
    }));
  });

  ipcMain.handle(IPC_CHANNELS.TIMELINE.UPDATE, async (_, id: string, updates: Partial<TimelineNode>) => {
    const db = await getDatabase();
    db.run(`
      UPDATE timeline_nodes 
      SET title = ?, date = ?, description = ?, order_index = ?
      WHERE id = '${id}'
    `, [updates.title, updates.date, updates.description || '', updates.orderIndex]);
  });

  ipcMain.handle(IPC_CHANNELS.TIMELINE.DELETE, async (_, id: string) => {
    const db = await getDatabase();
    db.run(`DELETE FROM timeline_nodes WHERE id = '${id}'`);
  });
}

function registerCharacterHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CHARACTER.CREATE, async (_, projectId: string, character: Omit<Character, 'id' | 'projectId' | 'createdAt'>) => {
    const db = await getDatabase();
    const newCharacter: Character = {
      id: generateId(),
      projectId,
      ...character,
      createdAt: Date.now(),
    };

    db.run(`
      INSERT INTO characters (id, project_id, name, avatar, personality, background, relationships, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newCharacter.id,
      newCharacter.projectId,
      newCharacter.name,
      newCharacter.avatar || '',
      newCharacter.personality || '',
      newCharacter.background || '',
      newCharacter.relationships || '',
      newCharacter.createdAt
    ]);

    return newCharacter;
  });

  ipcMain.handle(IPC_CHANNELS.CHARACTER.GET_ALL, async (_, projectId: string) => {
    const db = await getDatabase();
    const result = db.exec(`SELECT * FROM characters WHERE project_id = '${projectId}'`);
    
    if (result.length === 0) return [];

    return result[0].values.map((row: any[]) => ({
      id: row[0],
      projectId: row[1],
      name: row[2],
      avatar: row[3],
      personality: row[4],
      background: row[5],
      relationships: row[6],
      createdAt: row[7],
    }));
  });

  ipcMain.handle(IPC_CHANNELS.CHARACTER.UPDATE, async (_, id: string, updates: Partial<Character>) => {
    const db = await getDatabase();
    db.run(`
      UPDATE characters 
      SET name = ?, avatar = ?, personality = ?, background = ?, relationships = ?
      WHERE id = '${id}'
    `, [
      updates.name,
      updates.avatar || '',
      updates.personality || '',
      updates.background || '',
      updates.relationships || '',
    ]);
  });

  ipcMain.handle(IPC_CHANNELS.CHARACTER.DELETE, async (_, id: string) => {
    const db = await getDatabase();
    db.run(`DELETE FROM characters WHERE id = '${id}'`);
  });
}

function registerExportHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.EXPORT.SAVE, async (_, { projectId, format }: { projectId: string; format: 'txt' | 'md' }) => {
    const { dialog } = await import('electron');
    const fs = await import('fs/promises');
    const path = await import('path');

    const db = await getDatabase();
    
    const projectResult = db.exec(`SELECT * FROM projects WHERE id = '${projectId}'`);
    const project = projectResult[0]?.values[0] ? {
      id: projectResult[0].values[0][0],
      title: projectResult[0].values[0][1],
      description: projectResult[0].values[0][2],
    } : null;

    const timelinesResult = db.exec(`SELECT * FROM timeline_nodes WHERE project_id = '${projectId}' ORDER BY order_index ASC`);
    const timelines = timelinesResult[0]?.values.map((row: any[]) => ({
      id: row[0],
      title: row[2],
      date: row[3],
      description: row[4],
    })) || [];

    const charactersResult = db.exec(`SELECT * FROM characters WHERE project_id = '${projectId}'`);
    const characters = charactersResult[0]?.values.map((row: any[]) => ({
      id: row[0],
      name: row[2],
      avatar: row[3],
      personality: row[4],
      background: row[5],
      relationships: row[6],
    })) || [];

    const chatsResult = db.exec(`SELECT * FROM chats WHERE project_id = '${projectId}'`);
    const chats = chatsResult[0]?.values.map((row: any[]) => ({
      id: row[0],
      title: row[2],
    })) || [];
    
    const messagesData: Record<string, any[]> = {};
    for (const chat of chats) {
      const messagesResult = db.exec(`SELECT * FROM messages WHERE chat_id = '${chat.id}' AND deleted = 0 ORDER BY order_index ASC`);
      messagesData[chat.id] = messagesResult[0]?.values.map((row: any[]) => ({
        role: row[2],
        content: row[3],
      })) || [];
    }

    if (!project) {
      throw new Error('Project not found');
    }

    let content: string;

    if (format === 'md') {
      content = exportToMarkdown(project, timelines, characters, chats, messagesData);
    } else {
      content = exportToText(project, timelines, characters, chats, messagesData);
    }

    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `${project.title}.${format}`,
      filters: [
        { name: format.toUpperCase(), extensions: [format] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!filePath) {
      throw new Error('User cancelled');
    }

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  });
}

function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, async (_, key: string) => {
    const db = await getDatabase();
    const result = db.exec(`SELECT value FROM settings WHERE key = '${key}'`);
    
    if (result.length === 0 || result[0].values.length === 0) return null;
    
    return result[0].values[0][0];
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SET, async (_, key: string, value: string) => {
    const db = await getDatabase();
    db.run(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `, [key, value]);
  });
}

async function getProjectById(db: any, id: string): Promise<Project | null> {
  const result = db.exec(`SELECT * FROM projects WHERE id = '${id}'`);
  
  if (result.length === 0 || result[0].values.length === 0) return null;

  const row = result[0].values[0];
  return {
    id: row[0],
    title: row[1],
    description: row[2],
    createdAt: row[3],
    updatedAt: row[4],
  };
}

function getNextOrderIndex(db: any, chatId: string): number {
  const result = db.exec(`SELECT MAX(order_index) as max_order FROM messages WHERE chat_id = '${chatId}'`);
  if (result.length === 0 || result[0].values.length === 0) return 1;
  const maxOrder = result[0].values[0][0];
  return (maxOrder || 0) + 1;
}

function getNextTimelineOrderIndex(db: any, projectId: string): number {
  const result = db.exec(`SELECT MAX(order_index) as max_order FROM timeline_nodes WHERE project_id = '${projectId}'`);
  if (result.length === 0 || result[0].values.length === 0) return 1;
  const maxOrder = result[0].values[0][0];
  return (maxOrder || 0) + 1;
}

function exportToMarkdown(project: any, timelines: any[], characters: any[], chats: any[], messagesData: Record<string, any[]>): string {
  const lines: string[] = [];
  
  lines.push(`# ${project.title}`);
  lines.push(`\n*导出时间：${new Date().toLocaleString('zh-CN')}*\n`);
  
  if (project.description) {
    lines.push(`## 简介`);
    lines.push(project.description);
    lines.push('');
  }
  
  if (timelines.length > 0) {
    lines.push(`## 时间线`);
    lines.push(``);
    timelines.forEach((node, index) => {
      lines.push(`### ${index + 1}. ${node.title}`);
      lines.push(`**时间**：${new Date(node.date).toLocaleDateString('zh-CN')}`);
      if (node.description) {
        lines.push(`**描述**：${node.description}`);
      }
      lines.push('');
    });
  }
  
  if (characters.length > 0) {
    lines.push(`## 人物`);
    lines.push(``);
    characters.forEach(char => {
      lines.push(`### ${char.name}`);
      if (char.personality) lines.push(`**性格**：${char.personality}`);
      if (char.background) lines.push(`**背景**：${char.background}`);
      if (char.relationships) {
        try {
          const relations = JSON.parse(char.relationships);
          lines.push(`**关系**：${Object.entries(relations).map(([k, v]) => `${k}: ${v}`).join('，')}`);
        } catch {
          lines.push(`**关系**：${char.relationships}`);
        }
      }
      lines.push('');
    });
  }
  
  if (chats.length > 0) {
    lines.push(`## 正文`);
    lines.push(``);
    chats.forEach(chat => {
      lines.push(`### ${chat.title}`);
      lines.push(``);
      const messages = messagesData[chat.id] || [];
      messages.forEach((msg: any) => {
        const roleLabel = msg.role === 'user' ? '作者' : 'AI';
        lines.push(`**${roleLabel}**：`);
        lines.push(msg.content);
        lines.push('');
      });
    });
  }
  
  return lines.join('\n');
}

function exportToText(project: any, timelines: any[], characters: any[], chats: any[], messagesData: Record<string, any[]>): string {
  const lines: string[] = [];
  
  lines.push(`${'='.repeat(50)}`);
  lines.push(`${project.title}`);
  lines.push(`${'='.repeat(50)}`);
  lines.push('');
  lines.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  
  if (project.description) {
    lines.push(`【简介】`);
    lines.push(project.description);
    lines.push('');
  }
  
  if (timelines.length > 0) {
    lines.push(`【时间线】`);
    lines.push(``);
    timelines.forEach((node, index) => {
      lines.push(`${index + 1}. ${node.title}`);
      lines.push(`   时间：${new Date(node.date).toLocaleDateString('zh-CN')}`);
      if (node.description) {
        lines.push(`   描述：${node.description}`);
      }
      lines.push('');
    });
  }
  
  if (characters.length > 0) {
    lines.push(`【人物】`);
    lines.push(``);
    characters.forEach(char => {
      lines.push(char.name);
      if (char.personality) lines.push(`   性格：${char.personality}`);
      if (char.background) lines.push(`   背景：${char.background}`);
      lines.push('');
    });
  }
  
  if (chats.length > 0) {
    lines.push(`【正文】`);
    lines.push(``);
    chats.forEach(chat => {
      lines.push(`--- ${chat.title} ---`);
      lines.push(``);
      const messages = messagesData[chat.id] || [];
      messages.forEach((msg: any) => {
        const roleLabel = msg.role === 'user' ? '作者' : 'AI';
        lines.push(`[${roleLabel}]`);
        lines.push(msg.content);
        lines.push('');
      });
    });
  }
  
  return lines.join('\n');
}
