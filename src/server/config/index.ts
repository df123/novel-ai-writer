// 配置管理
import path from 'path';
import os from 'os';

/**
 * LLM 模型接口
 */
export interface LLMModel {
  id: string;
  name: string;
}

/**
 * LLM 提供商接口
 */
export interface LLMProvider {
  apiUrl: string;
  models?: LLMModel[];
  modelsUrl?: string;
}

/**
 * LLM 提供商配置
 */
export type LLMProviders = Record<string, LLMProvider>;

/** 服务器端口 */
export const PORT: number = Number(process.env.PORT) || 3002;

/** 数据库目录 */
export const dbDir: string = process.env.DB_DIR || path.join(os.homedir(), '.novel-ai-writer');

/** 数据库路径 */
export const dbPath: string = path.join(dbDir, 'database.db');

/** 允许访问的表白名单 */
export const ALLOWED_TABLES: readonly string[] = [
  'projects',
  'chats',
  'messages',
  'timeline_nodes',
  'characters',
  'prompt_templates',
  'settings',
  'timeline_versions',
  'character_versions'
] as const;

/** LLM 提供商配置 */
export const LLM_PROVIDERS: LLMProviders = {
  deepseek: {
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
    ]
  },
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    modelsUrl: 'https://openrouter.ai/api/v1/models'
  }
};
