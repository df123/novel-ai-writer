# NovelAI Writer - LLM辅助小说写作工具

一款利用大语言模型（LLM）辅助小说写作的Web应用。

## 功能特性

- **LLM写作区**：与AI助手进行对话，获取写作建议和内容生成
- **时间线管理**：创建和管理小说的时间节点、事件顺序，支持版本管理
- **人物线管理**：创建角色设定、关系网络和发展轨迹，支持版本管理
- **上下文注入**：将选中的时间线和人物信息注入到对话中
- **版本管理**：为时间线节点和人物创建版本历史，支持回退到任意版本
- **多LLM提供商**：支持DeepSeek、OpenRouter等主流LLM服务
- **思考模式**：支持LLM的推理/思考过程显示
- **导出功能**：支持导出为Markdown和文本格式

## 技术栈

- **前端框架**：Vue.js 3 + TypeScript
- **UI库**：Element Plus
- **状态管理**：Pinia
- **路由**：Vue Router
- **后端框架**：Express.js
- **数据库**：SQLite (sql.js)
- **构建工具**：Vite
- **包管理器**：pnpm

## 安装

推荐使用 [pnpm](https://pnpm.io/) 作为包管理器：

```bash
# 全局安装 pnpm（如果还没有）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

## Docker 部署

### 快速启动

1. 复制环境变量配置文件：
   ```bash
   cp .env.example .env
   ```

2. **重要：生成加密密钥**（首次部署必须执行）：
   ```bash
   # 生成随机的加密密钥并写入 .env
   sed -i "s/^ENCRYPTION_KEY=$/ENCRYPTION_KEY=$(openssl rand -hex 16)/" .env
   ```

3. 启动服务：
   ```bash
   docker-compose up -d
   ```

4. 访问应用：`http://localhost:3002`

### ⚠️ 注意事项

- **加密密钥（ENCRYPTION_KEY）**：用于加密存储 API 密钥。首次部署时必须设置，设置后请勿更改，否则已保存的 API 密钥将无法解密。
- **数据持久化**：Docker 使用命名卷 `novel-ai-data` 存储数据库，`docker-compose down` 不会删除数据（除非使用 `-v` 参数）。
- **更新部署**：重建容器时 API 密钥不会丢失，前提是 `.env` 中的 `ENCRYPTION_KEY` 保持不变。

## 开发

```bash
# 启动开发模式（同时启动后端和前端）
pnpm dev

# 仅启动后端服务器 (端口 3002)
pnpm dev:server

# 仅启动前端开发服务器 (端口 3004)
pnpm dev:renderer
```

## 构建

```bash
# 构建前端生产版本
pnpm build

# 本地预览构建后的应用
pnpm preview
```

## 代码质量

```bash
# 运行 TypeScript 类型检查
pnpm typecheck

# 运行 ESLint 检查
pnpm lint
```

## 使用说明

1. **创建项目**：首次运行时，点击"创建第一个项目"按钮
2. **配置LLM**：在设置中输入您的API密钥（支持DeepSeek和OpenRouter）
3. **添加时间节点**：在左侧时间线面板添加故事的时间节点
4. **添加人物**：在右侧人物面板添加角色信息
5. **选择上下文**：勾选需要注入到对话中的时间线和人物
6. **开始写作**：在中间写作区输入问题或需求，AI会根据选中的上下文生成内容

## 版本管理

### 时间线版本管理
- 更新时间线节点时，可以选择创建新版本
- 点击节点上的时钟图标查看版本历史
- 点击"恢复"按钮将时间线回退到指定版本

### 人物版本管理
- 更新人物信息时，可以选择创建新版本
- 点击人物卡片上的时钟图标查看版本历史
- 点击"恢复"按钮将人物信息回退到指定版本

## 项目结构

```
novel-ai/
├── src/
│   ├── server/            # Express 后端
│   │   └── index.ts       # 后端入口
│   ├── renderer/          # Vue.js 前端
│   │   ├── components/    # UI组件
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── utils/         # 工具函数和 API 调用
│   │   └── App.vue        # 主应用组件
│   └── shared/            # 共享代码
│       ├── types.ts       # TypeScript 类型定义
│       └── utils.ts       # 共享工具函数
├── docs/                  # 文档
├── logs/                  # 日志文件
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

## 数据库

项目使用 SQLite 数据库，数据文件存储在：
- Linux/macOS: `~/.novel-ai-writer/database.db`
- Windows: `%APPDATA%/novel-ai-writer/database.db`

API 密钥使用 AES-256-CBC 加密存储，确保安全性。

## LLM 提供商配置

### DeepSeek
- **模型**: `deepseek-chat`, `deepseek-reasoner`
- **API Endpoint**: `https://api.deepseek.com/v1/chat/completions`

### OpenRouter
- **模型**: 从 API 动态获取
- **API Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **思考模式**: 默认启用，使用 `reasoning: { enabled: true }`

## 为什么要用pnpm

- **节省磁盘空间**：pnpm使用硬链接，不重复下载相同版本的包
- **更快的安装速度**：比npm和yarn更快
- **严格的依赖管理**：避免幽灵依赖问题
- **支持Monorepo**：便于管理多包项目

## 注意事项

- API 密钥将加密存储在本地
- 首次使用需要配置 LLM API 密钥
- 推荐使用现代浏览器（Chrome、Firefox、Edge、Safari）
- 后端服务器运行在 http://localhost:3002
- 前端开发服务器运行在 http://localhost:3004
- Docker 部署时必须在 `.env` 文件中设置 `ENCRYPTION_KEY`，否则容器重建后 API 密钥将无法解密

## License

MIT
