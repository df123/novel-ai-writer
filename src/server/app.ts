// Express 应用工厂：注册全部中间件与路由，供 index.ts 启动与测试复用
// public 模式（设计书 §16/§17/§19/§29）：Web 门卫只挂 /api/*，MCP/OAuth/well-known 保持原认证模型
import express from 'express';
import cors from 'cors';
import path from 'path';

import * as fs from 'fs';
import { dbDir, isPublicMode } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { webApiGuard, securityHeaders, apiNoStore } from './web/webSecurity';
import { rateLimitMiddleware } from './web/webRateLimit';
import type { App } from './types/express.types';

// 导入路由
import webAuthRouter from './routes/webAuth';
import projectsRouter from './routes/projects';
import chatsRouter from './routes/chats';
import messagesRouter from './routes/messages';
import timelineRouter from './routes/timeline';
import charactersRouter from './routes/characters';
import chaptersRouter from './routes/chapters';
import themesRouter from './routes/themes';
import llmRouter from './routes/llm';
import settingsRouter from './routes/settings';
import promptsRouter from './routes/prompts';
import exportRouter from './routes/export';
import databaseRouter from './routes/database';
import miscRecordsRouter from './routes/miscRecords';
import researchRouter from './routes/research';
import speechRouter from './routes/speech';
import illustrationsRouter from './routes/illustrations';
import mcpRouter from './routes/mcp';

/** 请求日志：路径脱敏（下载令牌不落日志）且不记录 query string（设计书 §37/§39） */
function logRequestMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const timestamp = new Date().toISOString();
    const safePath = req.path.startsWith('/mcp/download/')
      ? '/mcp/download/[REDACTED]'
      : req.path;
    console.log(`[${timestamp}] ${req.method} ${safePath} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}

/**
 * 创建 Express 应用（需在 initDB 完成后调用）
 */
export function createApp(): App {
  const app: App = express();

  if (isPublicMode()) {
    // 公网部署在 Apache 反代之后，取真实客户端 IP 供限流使用。
    // 只信任回环来源的代理：Apache(127.0.0.1)可信、其左侧 XFF 为伪造不可信，
    // 避免攻击者伪造 X-Forwarded-For 绕过按 IP 的登录/OAuth 限流
    app.set('trust proxy', 'loopback');
    // 同源 SPA，公网完全不需要 CORS（设计书 §19）
  } else {
    app.use(cors());
  }

  app.use(logRequestMiddleware);

  // 路径级 body 解析（取代原全局 parser，设计书 §29 各边界独立真实生效）：
  // 先挂的具体路径先生效（body-parser 首个解析后其余跳过）。
  // 登录 8KB 体量极小、且是门卫豁免路径，解析放前无 DoS 面；
  // 业务 /api 的 4MB 解析刻意放在会话门卫与限流之后（未认证请求先 401，不接收大 body）；
  // /mcp 的 50MB 解析放在 MCP Bearer 认证之后（见 routes/mcp.ts，评审 P1）。
  // OAuth JSON 统一收紧到 16KB（authorize/token 走 urlencoded 不受影响）
  app.use('/api/auth', express.json({ limit: '8kb' }));
  app.use('/oauth', express.json({ limit: '16kb' }));

  if (isPublicMode()) {
    app.use(securityHeaders);
  }

  // 确保数据库目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // ===== Web API（/api/*）：public 模式统一过会话+CSRF 门卫与常规限流 =====
  console.log('=== 开始注册路由 ===');
  app.use('/api', apiNoStore);
  if (isPublicMode()) {
    app.use('/api', webApiGuard);
    app.use('/api', rateLimitMiddleware('api'));
  }
  // 业务 API 的 JSON 解析在门卫/限流之后（未登录先 401；local 无门卫行为不变）
  app.use('/api', express.json({ limit: isPublicMode() ? '4mb' : '50mb' }));

  app.use('/api/auth', webAuthRouter);
  app.use('/api/settings', settingsRouter);
  // 高成本接口限流仅在 public 模式启用（设计书 §30；local 保持现状）
  const withLimit = (name: 'llm' | 'research' | 'speech' | 'illustration' | 'export') =>
    isPublicMode() ? rateLimitMiddleware(name) : (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
  app.use('/api/llm', withLimit('llm'), llmRouter);
  app.use('/api/prompts', promptsRouter);
  // 数据库管理台仅内网注册；public 模式整个 /api/db 不存在（设计书 §6/P0-3）
  if (!isPublicMode()) {
    app.use('/api/db', databaseRouter);
  }
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:projectId/chapters', chaptersRouter);
  app.use('/api/themes', themesRouter);
  app.use('/api/projects/:projectId/themes', themesRouter);
  app.use('/api', messagesRouter);
  app.use('/api', chatsRouter);
  app.use('/api', timelineRouter);
  app.use('/api', charactersRouter);
  app.use('/api', exportRouter);
  app.use('/api', miscRecordsRouter);
  app.use('/api/research', withLimit('research'), researchRouter);
  app.use('/api/speech', withLimit('speech'), speechRouter);
  app.use('/api/illustrations', withLimit('illustration'), illustrationsRouter);
  console.log(`=== 路由注册完成（APP_MODE=${isPublicMode() ? 'public' : 'local'}） ===`);

  // MCP 及其配套端点（/mcp、/health、well-known、导出下载）
  // 必须在 SPA fallback 与 404 之前注册，避免被 index.html 吞掉；
  // Web 会话/CSRF 门卫只挂 /api/*，此处刻意不套用（设计书 §16）
  app.use(mcpRouter);

  // 托管前端静态文件（生产模式）
  if (process.env.NODE_ENV !== 'development') {
    const rendererPath = path.resolve(process.cwd(), 'dist/renderer');
    // 带哈希的构建产物可长期缓存，index.html 必须每次校验（设计书 §38）
    app.use(express.static(rendererPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));

    // SPA fallback：非 API/MCP 请求返回 index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/mcp') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(rendererPath, 'index.html'));
    });
  }

  // 404 处理
  app.use(notFoundHandler as any);

  // 错误处理
  app.use(errorHandler as any);

  return app;
}
