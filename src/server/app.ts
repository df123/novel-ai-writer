// Express 应用工厂：注册全部中间件与路由，供 index.ts 启动与测试复用
import express from 'express';
import cors from 'cors';
import path from 'path';

import * as fs from 'fs';
import { dbDir } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import type { App } from './types/express.types';

// 导入路由
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

/**
 * 创建 Express 应用（需在 initDB 完成后调用）
 */
export function createApp(): App {
  const app: App = express();

  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // 请求日志中间件
  app.use((req, _res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });

  // 确保数据库目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 注册路由（具体路径优先于通用路径）
  console.log('=== 开始注册路由 ===');
  app.use('/api/settings', settingsRouter);
  app.use('/api/llm', llmRouter);
  app.use('/api/prompts', promptsRouter);
  app.use('/api/db', databaseRouter);
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
  app.use('/api/research', researchRouter);
  app.use('/api/speech', speechRouter);
  app.use('/api/illustrations', illustrationsRouter);
  console.log('=== 路由注册完成 ===');

  // MCP 及其配套端点（/mcp、/health、well-known、导出下载）
  // 必须在 SPA fallback 与 404 之前注册，避免被 index.html 吞掉
  app.use(mcpRouter);

  // 托管前端静态文件（生产模式）
  if (process.env.NODE_ENV !== 'development') {
    const rendererPath = path.resolve(process.cwd(), 'dist/renderer');
    app.use(express.static(rendererPath));

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
