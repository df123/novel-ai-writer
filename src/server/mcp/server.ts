// MCP Server 工厂：注册全部工具，每个请求独立实例（无状态，无 currentProject 概念）
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION, MCP_SERVER_INSTRUCTIONS } from './instructions';
import { checkRateLimit } from './rateLimit';
import { toToolErrorText } from './errors';
import { registerProjectTools } from './tools/projects';
import { registerContextTools } from './tools/context';
import { registerThemeTools } from './tools/theme';
import { registerTimelineTools } from './tools/timeline';
import { registerCharacterTools } from './tools/characters';
import { registerWorldTools } from './tools/world';
import { registerChapterTools } from './tools/chapters';
import { registerVersionTools } from './tools/versions';
import { registerExportTools } from './tools/export';

/**
 * 创建配置完整的 MCP Server 实例
 * 无状态设计：工具不依赖任何会话/全局当前项目，所有领域工具显式传 project_id
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: MCP_SERVER_INSTRUCTIONS }
  );

  registerProjectTools(server);
  registerContextTools(server);
  registerThemeTools(server);
  registerTimelineTools(server);
  registerCharacterTools(server);
  registerWorldTools(server);
  registerChapterTools(server);
  registerVersionTools(server);
  registerExportTools(server);

  return server;
}

/**
 * 工具回调统一包装：限流 + 日志 + 领域错误转可恢复文本
 * 永远返回 CallToolResult，业务失败以 isError=true 表达
 */
export async function runTool(
  toolName: string,
  projectId: string | undefined,
  fn: () => CallToolResult | Promise<CallToolResult>
): Promise<CallToolResult> {
  const limited = checkRateLimit(toolName);
  if (limited) {
    return { content: [{ type: 'text', text: limited }], isError: true };
  }
  const start = Date.now();
  try {
    const result = await fn();
    logTool(toolName, projectId, Date.now() - start, 'ok');
    return result;
  } catch (error) {
    const text = toToolErrorText(error);
    logTool(toolName, projectId, Date.now() - start, 'error');
    return { content: [{ type: 'text', text }], isError: true };
  }
}

/** 工具日志：只记录元数据，不记录正文/密钥 */
function logTool(toolName: string, projectId: string | undefined, durationMs: number, outcome: string): void {
  console.log(`[mcp] tool=${toolName} project=${projectId ?? '-'} duration=${durationMs}ms ${outcome}`);
}
