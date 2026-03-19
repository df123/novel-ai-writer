// 主入口文件
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { dbDir } = require('./config');
const { initDB } = require('./db');
const { PORT } = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 导入路由
const projectsRouter = require('./routes/projects');
const chatsRouter = require('./routes/chats');
const messagesRouter = require('./routes/messages');
const timelineRouter = require('./routes/timeline');
const charactersRouter = require('./routes/characters');
const llmRouter = require('./routes/llm');
const settingsRouter = require('./routes/settings');
const promptsRouter = require('./routes/prompts');
const exportRouter = require('./routes/export');
const databaseRouter = require('./routes/database');

// 初始化 Express 应用
const app = express();

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
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
