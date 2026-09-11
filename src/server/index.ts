// 服务器入口：初始化数据库后启动 Express
import { PORT } from './config';
import { initDB } from './db';
import { createApp } from './app';

initDB()
  .then(() => {
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
    });
  })
  .catch((err: Error) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
