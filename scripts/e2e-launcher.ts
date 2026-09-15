// e2e 浏览器测试专用启动器：跳过 index.ts 的公网 fail-fast 校验（该逻辑另有单测覆盖），
// 直接装配 createApp，供 playwright-tester 对 public/local 两种模式做黑盒验证。
// 所有配置（DB_DIR/APP_MODE/WEB_* 等）由调用方通过环境变量注入，务必使用临时数据库。
import { initDB } from '../src/server/db';
import { createApp } from '../src/server/app';
import { PORT, getAppMode } from '../src/server/config';

const HOST = process.env.HOST || '127.0.0.1';

initDB()
  .then(() => {
    const app = createApp();
    app.listen(PORT, HOST, () => {
      console.log(`[e2e] server running on http://${HOST}:${PORT} (APP_MODE=${getAppMode()})`);
    });
  })
  .catch((err: Error) => {
    console.error('[e2e] failed to start:', err);
    process.exit(1);
  });
