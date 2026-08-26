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
  responsesUrl?: string;
  goApiUrl?: string;
  goModelsUrl?: string;
  goResponsesUrl?: string;
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
  'chapters',
  'prompt_templates',
  'settings',
  'timeline_versions',
  'character_versions',
  'themes',
  'theme_history',
  'misc_records',
  'misc_record_versions'
] as const;

/** LLM 提供商配置 */
export const LLM_PROVIDERS: LLMProviders = {
  deepseek: {
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    responsesUrl: 'https://api.deepseek.com/responses',
    modelsUrl: 'https://api.deepseek.com/models',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
    ]
  },
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    responsesUrl: 'https://openrouter.ai/api/v1/responses',
    modelsUrl: 'https://openrouter.ai/api/v1/models'
  },
  zai: {
    apiUrl: 'https://api.z.ai/api/coding/paas/v4/chat/completions',
    responsesUrl: 'https://api.z.ai/api/v1/responses',
    modelsUrl: 'https://api.z.ai/api/coding/paas/v4/models',
    models: [
      { id: 'glm-5.3', name: 'GLM-5.3' },
      { id: 'glm-5.2', name: 'GLM-5.2' },
    ]
  },
  opencode: {
    apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
    modelsUrl: 'https://opencode.ai/zen/v1/models',
    responsesUrl: 'https://opencode.ai/zen/v1/responses',
    goApiUrl: 'https://opencode.ai/zen/go/v1/chat/completions',
    goModelsUrl: 'https://opencode.ai/zen/go/v1/models',
    goResponsesUrl: 'https://opencode.ai/zen/go/v1/responses'
  },
  cliproxy: {
    apiUrl: 'chat/completions',
    responsesUrl: 'responses',
    modelsUrl: 'models'
  }
};

/** CLI Proxy API 默认地址 */
export const CLIPROXY_DEFAULT_BASE_URL = 'http://127.0.0.1:8317/v1';
