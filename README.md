# NovelAI Writer - LLM辅助小说写作工具

一款利用大语言模型（LLM）辅助小说写作的跨平台桌面应用。

## 功能特性

- **LLM写作区**：与AI助手进行对话，获取写作建议和内容生成
- **时间线管理**：创建和管理小说的时间节点、事件顺序
- **人物线管理**：创建角色设定、关系网络和发展轨迹
- **上下文注入**：自动将时间线和人物信息注入到对话中
- **多LLM提供商**：支持OpenAI、DeepSeek等主流LLM服务
- **导出功能**：支持导出为Markdown和文本格式

## 技术栈

- **前端框架**：Electron + React + TypeScript
- **UI库**：Material-UI (MUI)
- **状态管理**：Zustand
- **数据库**：SQLite (better-sqlite3)
- **构建工具**：Vite

## 安装

```bash
# 安装依赖
npm install
```

## 开发

```bash
# 启动开发模式
npm run dev

# 启动Electron应用（需要先构建）
npm run build
npm run electron
```

## 构建

```bash
# 构建项目
npm run build

# 打包应用
npm run dist
```

## 使用说明

1. **创建项目**：首次运行时，点击"创建第一个项目"按钮
2. **配置LLM**：在设置中输入您的API密钥（支持OpenAI和DeepSeek）
3. **添加时间节点**：在左侧时间线面板添加故事的时间节点
4. **添加人物**：在右侧人物面板添加角色信息
5. **开始写作**：在中间写作区输入问题或需求，AI会根据上下文生成内容

## 项目结构

```
novel-ai/
├── src/
│   ├── main/              # Electron主进程
│   │   ├── database/      # 数据库
│   │   ├── ipc/           # IPC通信处理
│   │   ├── llm/           # LLM集成
│   │   └── index.ts       # 主进程入口
│   ├── renderer/          # 渲染进程（React）
│   │   ├── components/    # UI组件
│   │   ├── store/         # 状态管理
│   │   └── App.tsx        # 主应用组件
│   ├── preload/           # Preload脚本
│   └── shared/            # 共享代码
├── package.json
└── tsconfig.json
```

## 注意事项

- API密钥将加密存储在本地
- 首次使用需要配置LLM API密钥
- 支持Windows、macOS、Linux平台

## License

MIT
