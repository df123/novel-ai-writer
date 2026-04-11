# 阶段1：构建
FROM node:20-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 先复制依赖配置，利用 Docker 层缓存
COPY package.json pnpm-lock.yaml .npmrc ./

# 安装全部依赖（含 devDependencies，构建时需要）
RUN pnpm install --frozen-lockfile

# 复制全部源码
COPY . .

# 编译前后端
RUN pnpm build

# 阶段2：生产运行
FROM node:20-alpine AS production

WORKDIR /app

# 仅复制运行所需文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 创建数据和日志目录
RUN mkdir -p /app/data /app/logs

# 环境变量默认值
ENV NODE_ENV=production
ENV PORT=3002
ENV DB_DIR=/app/data

EXPOSE 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/api/settings || exit 1

# 启动命令
CMD ["node", "dist/server/index.js"]
