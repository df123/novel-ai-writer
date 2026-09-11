// MCP 结果构造：所有工具同时返回 structuredContent + 人类可读 content 摘要
// 不暴露数据库内部字段、file_path、secret 等服务器内部信息
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * 构造工具成功结果
 * @param structured 结构化数据（与工具 outputSchema 对应）
 * @param summary 面向模型/用户的简短文字摘要
 */
export function toolOk(structured: Record<string, unknown>, summary: string): CallToolResult {
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: structured
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
