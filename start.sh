#!/bin/bash

# 停止可能占用端口的进程
echo "Cleaning up ports..."
lsof -ti:3002 | xargs kill -9 2>/dev/null
lsof -ti:3004 | xargs kill -9 2>/dev/null
sleep 1

# 启动开发环境
echo "Starting NovelAI Writer..."
echo "  - Backend API: http://localhost:3002/api"
echo "  - Frontend: http://localhost:3004"
echo ""
pnpm dev
