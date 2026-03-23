// 数据库表结构定义
import type { DbPromptTemplate } from '@shared/types';

/**
 * 获取创建所有表的 SQL 语句
 * @returns 创建表的 SQL 语句
 */
export function getCreateTablesSQL(): string {
  return `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning_content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timeline_nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT,
      content TEXT,
      order_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      personality TEXT,
      background TEXT,
      relationships TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    -- 注意：已移除 avatar_url 字段。由于 SQLite 不支持 DROP COLUMN，
    -- 现有数据库中的 avatar_url 字段会保留但不再使用。
    -- 如需清理，请重新创建数据库或使用数据库迁移工具。

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timeline_versions (
      id TEXT PRIMARY KEY,
      timeline_node_id TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT,
      content TEXT,
      version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (timeline_node_id) REFERENCES timeline_nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS character_versions (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      name TEXT NOT NULL,
      personality TEXT,
      background TEXT,
      relationships TEXT,
      version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );
    -- 注意：已移除 avatar_url 字段。由于 SQLite 不支持 DROP COLUMN，
    -- 现有数据库中的 avatar_url 字段会保留但不再使用。
    -- 如需清理，请重新创建数据库或使用数据库迁移工具。

    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_project_id ON timeline_nodes(project_id);
    CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_versions_node_id ON timeline_versions(timeline_node_id);
    CREATE INDEX IF NOT EXISTS idx_character_versions_character_id ON character_versions(character_id);
  `;
}

/**
 * 获取数据库迁移 SQL 语句
 * @returns 迁移 SQL 语句数组
 */
export function getMigrationSQLs(): string[] {
  return [
    'ALTER TABLE messages ADD COLUMN tool_calls TEXT',
    'ALTER TABLE messages ADD COLUMN tool_call_id TEXT',
    'ALTER TABLE characters ADD COLUMN relationships TEXT',
    'ALTER TABLE character_versions ADD COLUMN relationships TEXT',
    'ALTER TABLE timeline_nodes ADD COLUMN date TEXT',
    'ALTER TABLE timeline_versions ADD COLUMN date TEXT'
  ];
}

/**
 * 获取默认提示词模板
 * @param generateId - 生成 ID 的函数
 * @param now - 获取时间戳的函数
 * @returns 默认提示词模板数组
 */
export function getDefaultPromptTemplates(
  generateId: () => string,
  now: () => number
): DbPromptTemplate[] {
  return [
    {
      id: generateId(),
      name: '基础写作助手',
      template: '你是一个专业的小说写作助手。请根据以下上下文帮助用户完成写作任务。\n\n当前场景：{{timeline_summary}}\n\n角色信息：{{character_summary}}\n\n请以{{writing_style}}的风格进行写作。',
      type: 'system',
      created_at: now()
    },
    {
      id: generateId(),
      name: '角色对话生成',
      template: '请帮助生成以下角色的对话：\n\n角色：{{character_name}}\n性格：{{character_personality}}\n背景：{{character_background}}\n\n对话场景：{{scene_description}}\n\n请保持角色的性格特征。',
      type: 'system',
      created_at: now()
    },
    {
      id: generateId(),
      name: '情节发展建议',
      template: '基于当前的故事情节，请提供3-5个可能的发展方向建议：\n\n当前情节：{{current_plot}}\n\n已有角色：{{character_summary}}\n\n时间线节点：{{timeline_summary}}',
      type: 'system',
      created_at: now()
    }
  ];
}
