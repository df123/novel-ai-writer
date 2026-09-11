// 测试环境准备：每个测试文件使用独立的临时数据库目录，绝不触碰真实 ~/.novel-ai-writer/database.db
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

process.env.NODE_ENV = 'development';
process.env.MCP_AUTH_MODE = 'none';
// 每个测试文件独立临时目录（vitest 为每个文件单独执行 setupFiles）
process.env.DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-ai-test-'));
