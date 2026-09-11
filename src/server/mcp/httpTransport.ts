// MCP Streamable HTTP 传输：无状态模式，每请求独立 transport + server 实例
import type { IncomingMessage, ServerResponse } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server';

/**
 * 处理 /mcp 的 HTTP 请求（initialize / tools/list / tools/call 等 JSON-RPC）
 * 会话无关设计：不使用 Mcp-Session-Id，任何顺序的请求都独立处理，
 * 适配反向代理与多个 ChatGPT 对话并发调用的场景
 */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  transport.onerror = (error) => {
    console.error('[mcp] transport error:', error.message);
  };

  try {
    await server.connect(transport);
    // express.json 已解析 body，直接传入解析结果
    await transport.handleRequest(req, res, (req as IncomingMessage & { body?: unknown }).body);
  } catch (error) {
    console.error('[mcp] request handling error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }));
    }
  }
}
