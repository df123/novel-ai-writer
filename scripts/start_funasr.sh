#!/bin/bash
# 启动 FunASR 语音识别服务(GPU,CUDA 透传)
# 端口: 3010(与本项目 3002/3004 同段,不冲突)
# 首次构建镜像: cd /home/df/funasr-server/examples/openai_api && docker build -f Dockerfile.cuda -t funasr-api:local .

CONTAINER_NAME="funasr-api"
HOST_PORT=3010
IMAGE="funasr-api:local"
MODEL_CACHE_DIR="$HOME/funasr-server/model-cache"

# 容器已存在则直接启动(保留模型缓存与配置)
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker start "${CONTAINER_NAME}"
  echo "FunASR 服务已启动: http://127.0.0.1:${HOST_PORT}"
  exit 0
fi

mkdir -p "${MODEL_CACHE_DIR}"

docker run -d \
  --name "${CONTAINER_NAME}" \
  --gpus all \
  --restart unless-stopped \
  --shm-size 2gb \
  -p ${HOST_PORT}:8000 \
  -e FUNASR_DEVICE=cuda \
  -e FUNASR_MODEL=sensevoice \
  -v "${MODEL_CACHE_DIR}:/root/.cache" \
  "${IMAGE}"

echo "FunASR 服务已创建并启动: http://127.0.0.1:${HOST_PORT}"
echo "健康检查: curl http://127.0.0.1:${HOST_PORT}/health"
