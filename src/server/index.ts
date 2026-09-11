// 服务器入口：初始化数据库后启动 Express
import { PORT } from './config';
import { initDB } from './db';
import { createApp } from './app';

/** 监听地址：公网部署建议 HOST=127.0.0.1 仅由反向代理访问，默认 0.0.0.0 保持内网直连行为 */
const HOST = process.env.HOST || '0.0.0.0';

initDB()
  .then(() => {
    const app = createApp();
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
      console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
    });
  })
  .catch((err: Error) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
