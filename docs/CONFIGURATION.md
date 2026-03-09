# NovelAI Writer - 项目配置总结

## 包管理器配置

### 使用 pnpm

本项目已配置使用 [pnpm](https://pnpm.io/) 作为包管理器。

### 相关文件

- `pnpm-lock.yaml` - pnpm 锁文件（自动生成，不要手动编辑）
- `.npmrc` - npm/pnpm 配置文件
- `.pnpmfile.cjs` - pnpm 钩子配置
- `pnpm-workspace.yaml` - 工作区配置

## 基础配置文件

### package.json
- 项目元数据和依赖管理
- 所有脚本命令已更新为使用 `pnpm`

### TypeScript 配置
- `tsconfig.json` - 主 TypeScript 配置
- `tsconfig.main.json` - Electron 主进程配置
- `tsconfig.node.json` - Node.js 相关配置

### Vite 配置
- `vite.config.ts` - Vite 构建工具配置

### Electron 配置
- 在 `package.json` 中通过 `build` 字段配置

## 项目结构

```
novel-ai/
├── .gitignore              # Git 忽略文件
├── .npmrc                 # npm/pnpm 配置
├── .pnpmfile.cjs          # pnpm 钩子
├── .pnpm-workspace.yaml   # pnpm 工作区
├── package.json           # 项目配置
├── pnpm-lock.yaml        # pnpm 锁文件
├── tsconfig.json         # TypeScript 配置
├── tsconfig.main.json    # 主进程 TypeScript 配置
├── tsconfig.node.json    # Node.js TypeScript 配置
├── vite.config.ts        # Vite 配置
├── README.md            # 项目说明
├── src/
│   ├── main/            # Electron 主进程
│   ├── renderer/        # 渲染进程（React）
│   ├── preload/         # Preload 脚本
│   └── shared/         # 共享代码
└── docs/               # 文档目录
    └── PNPM.md         # pnpm 使用指南
```

## 依赖管理

### 生产依赖
- react, react-dom, react-router-dom
- zustand (状态管理)
- @mui/material, @mui/icons-material (UI 组件)
- @emotion/react, @emotion/styled (CSS-in-JS)
- axios (HTTP 客户端)
- sql.js (SQLite 数据库)
- crypto-js (加密)
- date-fns (日期处理)

### 开发依赖
- typescript (TypeScript 编译器)
- vite (构建工具)
- @vitejs/plugin-react (Vite React 插件)
- vite-plugin-electron (Electron 集成)
- electron (Electron 运行时)
- electron-builder (应用打包)
- concurrently (并发运行命令)
- tsx (TypeScript 执行器)
- eslint (代码检查)
- @types/* (TypeScript 类型定义)

## 脚本命令

所有脚本命令都已更新为使用 `pnpm`：

- `pnpm dev` - 启动开发模式
- `pnpm build` - 构建项目
- `pnpm typecheck` - TypeScript 类型检查
- `pnpm lint` - 代码检查
- `pnpm dist` - 打包应用
- `pnpm electron` - 运行 Electron

## 验证安装

运行以下命令验证配置是否正确：

```bash
# 1. 检查 pnpm 版本
pnpm --version

# 2. 安装依赖（如果还没安装）
pnpm install

# 3. 运行类型检查
pnpm typecheck

# 4. 查看已安装的包
pnpm list --depth=0
```

## 注意事项

1. **不要手动编辑 `pnpm-lock.yaml`**
   - 该文件由 pnpm 自动生成和维护
   - 手动编辑可能导致依赖关系错误

2. **使用 pnpm 而不是 npm**
   - 所有命令都应使用 `pnpm`
   - 如需使用 npm，请先清理 `node_modules` 和 `pnpm-lock.yaml`

3. **版本兼容性**
   - Node.js 版本：>= 18.0.0
   - pnpm 版本：>= 8.0.0

4. **构建脚本**
   - Electron 相关包需要构建原生模块
   - pnpm 会自动处理这些构建脚本
