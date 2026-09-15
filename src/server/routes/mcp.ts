// MCP 及配套端点路由：/mcp、/health、OAuth well-known、授权端点、导出下载
// 必须在 SPA fallback 与 404 之前注册（见 app.ts）
import express, { Router, Request, Response } from 'express';
import { handleMcpRequest } from '../mcp/httpTransport';
import { mcpAuthMiddleware, oauthRouter, getAuthMode, getPublicBaseUrl } from '../mcp/auth';
import { consumeDownload } from '../mcp/downloads';
import { getDatabase } from '../db';
const router: Router = express.Router();

/**
 * 健康检查：只暴露服务状态，不含路径/密钥/私人内容
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'novel-ai-writer',
    mcp: true,
    database: !!getDatabase()
  });
});

/**
 * MCP 端点（Streamable HTTP，无状态）
 * GET/DELETE 由 SDK 返回 405，POST 承载全部 JSON-RPC。
 * 50MB 解析刻意放在 Bearer 认证之后：未认证请求先 401，不让服务端白白接收/解析超大 body（评审 P1）
 */
router.all('/mcp', mcpAuthMiddleware, express.json({ limit: '50mb' }), (req: Request, res: Response) => {
  void handleMcpRequest(req, res);
});

/**
 * 受保护资源元数据（MCP Authorization 规范）
 * 仅在 oauth 模式发布;token/none 模式返回 404,避免自动发现的客户端误入 OAuth 流程
 */
router.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
  if (getAuthMode() !== 'oauth') {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const base = getPublicBaseUrl();
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base]
  });
});

/**
 * 授权服务器元数据（OAuth 2.0 Authorization Server Metadata）
 */
router.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
  if (getAuthMode() !== 'oauth') {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const base = getPublicBaseUrl();
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256']
  });
});

/**
 * OAuth 授权服务器端点
 */
router.use('/oauth', oauthRouter);

/**
 * 导出文件下载（单次令牌，10 分钟过期）
 */
router.get('/mcp/download/:token', (req: Request, res: Response) => {
  const payload = consumeDownload(req.params.token);
  if (!payload) {
    res.status(404).json({ error: '下载令牌无效或已过期' });
    return;
  }
  res.setHeader('Content-Type', payload.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(payload.filename)}"`);
  res.send(payload.content);
});

/**
 * 启动时提示当前认证模式
 */
console.log(`[mcp] auth mode: ${getAuthMode()}${getAuthMode() === 'none' ? ' (dev only — set MCP_AUTH_MODE for production)' : ''}`);

export default router;
