# Pnpm 配置指南

本项目使用 [pnpm](https://pnpm.io/) 作为包管理器。

## 为什么选择 pnpm？

- **节省磁盘空间**：pnpm 使用硬链接，不重复下载相同版本的包
- **更快的安装速度**：比 npm 和 yarn 更快
- **严格的依赖管理**：避免幽灵依赖问题
- **支持 Monorepo**：便于管理多包项目

## 安装

```bash
# 全局安装 pnpm
npm install -g pnpm

# 验证安装
pnpm --version
```

## 使用 pnpm

### 安装依赖
```bash
pnpm install
```

### 运行脚本
```bash
# 开发模式
pnpm dev

# 构建项目
pnpm build

# 类型检查
pnpm typecheck

# 打包应用
pnpm dist
```

### 添加依赖
```bash
# 生产依赖
pnpm add <package>

# 开发依赖
pnpm add -D <package>
```

### 删除依赖
```bash
pnpm remove <package>
```

## 配置文件

- `.npmrc` - pnpm 配置文件
- `pnpm-lock.yaml` - 锁文件（不要手动编辑）
- `pnpm-workspace.yaml` - 工作区配置（未来支持 monorepo）

## 常见问题

### 如果必须使用 npm

1. 删除 `node_modules` 目录
2. 删除 `pnpm-lock.yaml` 文件
3. 运行 `npm install`
4. 更新 `package.json` 中的脚本命令（将 `pnpm` 改为 `npm`）

### 清理缓存

```bash
pnpm store prune
```

### 查看全局安装的包

```bash
pnpm list -g
```
