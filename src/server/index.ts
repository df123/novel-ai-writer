// 服务器入口：初始化数据库后启动 Express
// public 模式（设计书 §18/§44）：启动 fail-fast 校验 + 默认只监听回环地址
import { PORT, isPublicMode, validatePublicStartup } from './config';
import { initDB } from './db';
import { createApp } from './app';
import { deleteExpiredSessions } from './web/webSession';

const isPublic = isPublicMode();

// 公网模式默认只监听回环（由 Apache 反代），显式 HOST=0.0.0.0 直接拒绝启动（P0-8 fail-closed）
const HOST = process.env.HOST || (isPublic ? '127.0.0.1' : '0.0.0.0');

if (isPublic) {
  const errors = validatePublicStartup();
  if (errors.length > 0) {
    console.error('==================================================================');
    console.error('⚠️  APP_MODE=public 启动检查未通过（fail-fast）：');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error('==================================================================');
    process.exit(1);
  }
}

initDB()
  .then(() => {
    if (isPublic) {
      // 启动即清理过期 Web 会话，并每小时重复（设计书 §13）
      deleteExpiredSessions();
      setInterval(() => deleteExpiredSessions(), 60 * 60 * 1000).unref();
    }

    const app = createApp();
    const server = app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT} (APP_MODE=${isPublic ? 'public' : 'local'})`);
      console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
    });
    return server;
  })
  .catch((err: Error) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
