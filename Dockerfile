# 阶段1：构建前端
FROM node:20-alpine AS builder

ARG HTTP_PROXY
ARG HTTPS_PROXY
ENV http_proxy=${HTTP_PROXY}
ENV https_proxy=${HTTPS_PROXY}

RUN npm install -g pnpm@10
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# 只构建前端（后端用 tsx 直接运行源码，不需要编译）
RUN pnpm run build:renderer

# 阶段2：生产运行
FROM node:20-alpine AS production

ARG HTTP_PROXY
ARG HTTPS_PROXY
ENV http_proxy=${HTTP_PROXY}
ENV https_proxy=${HTTPS_PROXY}

RUN npm install -g pnpm@10
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV DB_DIR=/app/data

# 复制 package.json 和 lockfile
COPY package.json pnpm-lock.yaml ./

# 安装全部依赖（包含 tsx，它在 devDependencies 中）
RUN pnpm install --frozen-lockfile

# 复制源码（tsx 直接运行 .ts 文件）
COPY src/ ./src/

# 复制 TypeScript 配置
COPY tsconfig.server.json tsconfig.json ./

# 复制前端构建产物
COPY --from=builder /app/dist/renderer ./dist/renderer

# 创建数据目录
RUN mkdir -p /app/data /app/logs

EXPOSE 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/api/settings || exit 1

CMD ["sh", "-c", "pnpm start"]
