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
  'misc_record_versions',
  'chapter_versions',
  'illustrations'
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

// ===== Public Web 安全边界配置（设计书 §17/§18/§44）=====

/** 应用运行模式：local=内网信任模型（现状），public=公网暴露（启用 Web 登录/CSRF/限流等安全边界） */
export type AppMode = 'local' | 'public';

/** 读取应用运行模式（默认 local，保持内网行为不变） */
export function getAppMode(): AppMode {
  return process.env.APP_MODE === 'public' ? 'public' : 'local';
}

/** 是否处于公网模式（惰性读取环境变量，便于测试在导入后切换模式） */
export function isPublicMode(): boolean {
  return getAppMode() === 'public';
}

/** Web 对外基准 URL（公网模式 Origin 校验与启动检查用），如 https://writer.example.com */
export function getWebPublicUrl(): string {
  return (process.env.WEB_PUBLIC_URL || '').replace(/\/+$/, '');
}

/** Web 登录用户名（公网模式） */
export function getWebUsername(): string {
  return process.env.WEB_USERNAME || '';
}

/** Web 登录密码的 scrypt 哈希（公网模式），格式 scrypt:N:r:p:saltB64:hashB64 */
export function getWebPasswordHash(): string {
  return process.env.WEB_PASSWORD_HASH || '';
}

/** Web 会话绝对生命周期（秒），默认 7 天 */
export function getWebSessionTtlSeconds(): number {
  const hours = Number(process.env.WEB_SESSION_TTL_HOURS) || 168;
  return Math.max(1, hours) * 3600;
}

/** 单用户最大并发 Web 会话数 */
export const WEB_MAX_ACTIVE_SESSIONS = 5;

/** 内部服务在公网模式下的固定地址（浏览器不可控，SSRF 收敛用）；未设置时回退默认值 */
export function getServiceBaseUrl(kind: 'cliproxy' | 'funasr' | 'comfyui'): string {
  const defaults: Record<typeof kind, string> = {
    cliproxy: CLIPROXY_DEFAULT_BASE_URL,
    funasr: 'http://127.0.0.1:3010',
    comfyui: 'http://127.0.0.1:3011'
  };
  const envKey: Record<typeof kind, string | undefined> = {
    cliproxy: process.env.CLIPROXY_BASE_URL,
    funasr: process.env.FUNASR_BASE_URL,
    comfyui: process.env.COMFYUI_BASE_URL
  };
  return (envKey[kind] || defaults[kind]).replace(/\/+$/, '');
}

/**
 * 公网模式启动检查（设计书 §18 fail-fast）：返回致命错误列表，空列表表示通过。
 * MCP_AUTH_MODE=none 在公网模式升级为致命错误（local 模式仍允许并仅警告）。
 */
export function validatePublicStartup(): string[] {
  const errors: string[] = [];
  if (process.env.NODE_ENV !== 'production') {
    errors.push('APP_MODE=public 需要 NODE_ENV=production');
  }
  if (!/^https:\/\//.test(getWebPublicUrl())) {
    errors.push('APP_MODE=public 需要设置 WEB_PUBLIC_URL=https://<域名>');
  }
  if (!getWebUsername()) {
    errors.push('APP_MODE=public 需要设置 WEB_USERNAME');
  }
  if (!getWebPasswordHash().startsWith('scrypt:')) {
    errors.push('APP_MODE=public 需要设置 WEB_PASSWORD_HASH（用 scripts/hash-password.mjs 生成，格式 scrypt:N:r:p:salt:hash）');
  }
  if (!process.env.ENCRYPTION_KEY) {
    errors.push('APP_MODE=public 不允许机器指纹回退，必须显式设置 ENCRYPTION_KEY');
  }
  const mcpMode = (process.env.MCP_AUTH_MODE || 'none').toLowerCase();
  if (!['token', 'oauth'].includes(mcpMode)) {
    errors.push('APP_MODE=public 禁止 MCP_AUTH_MODE=none（token 或 oauth 二选一）');
  } else {
    if (!/^https:\/\//.test(process.env.MCP_PUBLIC_URL || '')) {
      errors.push('公网暴露 MCP 需要设置 MCP_PUBLIC_URL=https://<域名>');
    }
    if (mcpMode === 'oauth' && !process.env.MCP_OAUTH_PASSWORD) {
      errors.push('MCP_AUTH_MODE=oauth 公网部署必须设置 MCP_OAUTH_PASSWORD');
    }
    if (mcpMode === 'token' && !process.env.MCP_STATIC_TOKEN) {
      errors.push('MCP_AUTH_MODE=token 公网部署必须设置 MCP_STATIC_TOKEN');
    }
  }
  const host = process.env.HOST;
  if (host === '0.0.0.0' || host === '::') {
    errors.push('APP_MODE=public 禁止监听 0.0.0.0（默认 127.0.0.1，由反向代理转发）');
  }
  return errors;
}
