// 服务端提供商凭据解析与 Settings 白名单（设计书 §20/§21/§22）：
// public 模式下浏览器永不接触明文 API Key 与内部服务地址
import { query, run } from '../db';
import { withWriteTransaction } from '../db/transaction';
import { encrypt, decrypt, getMachineKey } from '../utils/crypto';

/** 提供商密钥 setting key 列表（write-only secrets） */
export const PROVIDER_SECRET_KEYS = [
  'deepseek_api_key',
  'openrouter_api_key',
  'zai_api_key',
  'opencode_api_key',
  'cliproxy_api_key'
] as const;

/** 普通可读写配置 key（public 模式允许浏览器修改） */
export const PUBLIC_WRITABLE_SETTING_KEYS = [
  'temperature',
  'selected_provider',
  'selected_model',
  'reasoning_effort',
  'zai_reasoning_enabled',
  'zai_reasoning_effort',
  'opencode_reasoning_enabled',
  'opencode_reasoning_effort',
  'cliproxy_reasoning_enabled',
  'cliproxy_reasoning_effort',
  'research_web_search_enabled',
  'research_web_reader_enabled',
  'research_wikipedia_enabled',
  'research_weather_enabled',
  'research_books_enabled',
  'show_thinking_content',
  'show_tool_calls'
] as const;

/** 仅服务器可控的内部地址 key（public 模式读写都禁止，来自环境变量） */
export const SERVER_ONLY_SETTING_KEYS = [
  'cliproxy_base_url',
  'speech_base_url',
  'illustration_base_url'
] as const;

const VERSION_KEY = '_provider_config_version';

/** 读取提供商配置版本号（模型缓存签名用，密钥永不离开服务器） */
export function getProviderConfigVersion(): number {
  const row = query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [VERSION_KEY])[0];
  return Number(row?.value) || 1;
}

/** 密钥变更时自增配置版本号（与密钥写入同一事务） */
function bumpProviderConfigVersion(): void {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)',
    [VERSION_KEY, '2']
  );
}

/** 服务端解密指定提供商的 API Key；未配置或解密失败返回空串 */
export function resolveProviderApiKey(provider: string): string {
  const key = `${provider}_api_key`;
  if (!PROVIDER_SECRET_KEYS.includes(key as (typeof PROVIDER_SECRET_KEYS)[number])) return '';
  const row = query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])[0];
  if (!row?.value) return '';
  try {
    return decrypt(row.value, getMachineKey());
  } catch (error) {
    console.error(`Failed to decrypt provider key ${provider}:`, error);
    return '';
  }
}

/** 加密写入提供商密钥并自增配置版本（单事务落盘） */
export function saveProviderSecret(key: string, value: string): void {
  withWriteTransaction(() => {
    if (value) {
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, encrypt(value, getMachineKey())]);
    } else {
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, '']);
    }
    bumpProviderConfigVersion();
  });
}
