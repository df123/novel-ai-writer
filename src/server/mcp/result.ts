// MCP 结果构造：所有工具同时返回 structuredContent + 人类可读 content 摘要
// 不暴露数据库内部字段、file_path、secret 等服务器内部信息
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** snake_case 键转 camelCase(project_id → projectId) */
function toCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * 递归移除与 camelCase 孪生字段并存的 snake_case 数据库原字段
 * 共享 formatter 用 ...dbRow 展开原始行再叠加 camelCase 字段,导致实体同时携带
 * project_id/projectId 等成对重复;outputSchema 只声明 camelCase 契约,故在 MCP 边界去重。
 * 仅当同对象内存在对应 camel 字段时才丢弃 snake 键(值相同,无信息损失);
 * 无孪生的 snake 字段(如 context 索引的 updated_at/chapter_number)原样保留。
 */
function stripDuplicatedDbFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDuplicatedDbFields);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(src)) {
    const twin = toCamelKey(key);
    if (twin !== key && twin in src) {
      continue;
    }
    out[key] = stripDuplicatedDbFields(v);
  }
  return out;
}

/**
 * 构造工具成功结果
 * @param structured 结构化数据（与工具 outputSchema 对应）
 * @param summary 面向模型/用户的简短文字摘要
 */
export function toolOk(structured: Record<string, unknown>, summary: string): CallToolResult {
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: stripDuplicatedDbFields(structured) as Record<string, unknown>
  };
}

/** 对象数组转换为可读的枚举行，用于 content 摘要 */
export function summarizeList(items: Array<{ title?: string; name?: string }>, label: string): string {
  if (items.length === 0) {
    return `No ${label} found.`;
  }
  const names = items.map(i => i.title || i.name || '').filter(Boolean).slice(0, 20).join(', ');
  const suffix = items.length > 20 ? ` …and ${items.length - 20} more` : '';
  return `${items.length} ${label}: ${names}${suffix}.`;
}
