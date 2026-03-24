import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import { dbDir, PORT } from './config';
import { initDB } from './db';
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

// 初始化 Express 应用
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
console.log('1. 注册 settingsRouter (路径: /api/settings)');
app.use('/api/settings', settingsRouter);
console.log('2. 注册 llmRouter (路径: /api/llm)');
app.use('/api/llm', llmRouter);
console.log('3. 注册 promptsRouter (路径: /api/prompts)');
app.use('/api/prompts', promptsRouter);
console.log('4. 注册 databaseRouter (路径: /api/db)');
app.use('/api/db', databaseRouter);
console.log('5. 注册 projectsRouter (路径: /api/projects)');
app.use('/api/projects', projectsRouter);
console.log('6. 注册 chaptersRouter (路径: /api/projects/:projectId/chapters)');
app.use('/api/projects/:projectId/chapters', chaptersRouter);
console.log('7. 注册 themesRouter (路径: /api/themes)');
app.use('/api/themes', themesRouter);
console.log('8. 注册 themesRouter (路径: /api/projects/:projectId/themes)');
app.use('/api/projects/:projectId/themes', themesRouter);
console.log('9. 注册 chatsRouter (路径: /api)');
app.use('/api', chatsRouter);
console.log('10. 注册 messagesRouter (路径: /api)');
app.use('/api', messagesRouter);
console.log('11. 注册 timelineRouter (路径: /api)');
app.use('/api', timelineRouter);
console.log('12. 注册 charactersRouter (路径: /api)');
app.use('/api', charactersRouter);
console.log('13. 注册 exportRouter (路径: /api)');
app.use('/api', exportRouter);
console.log('=== 路由注册完成 ===');

// 404 处理
app.use(notFoundHandler as any);

// 错误处理
app.use(errorHandler as any);

// 启动服务器
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('\n=== 已注册的路由 ===');
      console.log('chaptersRouter 路由:');
      console.log('  - GET /api/projects/:projectId/chapters');
      console.log('  - GET /api/projects/:projectId/chapters/:chapterId');
      console.log('  - POST /api/projects/:projectId/chapters');
      console.log('  - PUT /api/projects/:projectId/chapters/:chapterId');
      console.log('  - DELETE /api/projects/:projectId/chapters/:chapterId');
      console.log('  - PUT /api/projects/:projectId/chapters/:chapterId/restore');
      console.log('  - DELETE /api/projects/:projectId/chapters/:chapterId/permanent');
      console.log('  - PUT /api/projects/:projectId/chapters/order');
      console.log('  - GET /api/projects/:projectId/chapters/export');
      console.log('  - GET /api/projects/:projectId/chapters/trash');
      console.log('  - DELETE /api/projects/:projectId/chapters/trash/empty');
      console.log('\nthemesRouter 路由:');
      console.log('  - GET /api/themes/:id');
      console.log('  - PUT /api/themes/:id');
      console.log('  - DELETE /api/themes/:id');
      console.log('  - POST /api/themes/:id/restore');
      console.log('  - DELETE /api/themes/:id/permanent');
      console.log('  - GET /api/themes/:id/history');
      console.log('  - GET /api/themes/:id/history/:version');
      console.log('  - GET /api/projects/:projectId/themes');
      console.log('  - GET /api/projects/:projectId/themes/current');
      console.log('  - GET /api/projects/:projectId/themes/trash');
      console.log('  - POST /api/projects/:projectId/themes');
      console.log('\nprojectsRouter 路由:');
      console.log('  - GET /api/projects');
      console.log('  - GET /api/projects/:id');
      console.log('  - POST /api/projects');
      console.log('  - PUT /api/projects/:id');
      console.log('  - DELETE /api/projects/:id');
      console.log('====================\n');
    });
  })
  .catch((err: Error) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
