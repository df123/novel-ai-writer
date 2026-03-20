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

// 确保数据库目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 注册路由（具体路径优先于通用路径）
app.use('/api/projects', projectsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/llm', llmRouter);
app.use('/api/prompts', promptsRouter);
app.use('/api/db', databaseRouter);
app.use('/api', chatsRouter);
app.use('/api', messagesRouter);
app.use('/api', timelineRouter);
app.use('/api', charactersRouter);
app.use('/api', exportRouter);

// 404 处理
app.use(notFoundHandler as any);

// 错误处理
app.use(errorHandler as any);

// 启动服务器
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err: Error) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
