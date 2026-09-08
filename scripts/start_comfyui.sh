#!/bin/bash
# 启动 ComfyUI 生图服务(GPU,CUDA 透传,Z-Image-Turbo GGUF 量化)
# 端口: 3011(与本项目 3002/3004/3010 同段,不冲突)
# 目录: /home/df/comfyui-server/ComfyUI(venv 在 /home/df/comfyui-server/venv)
# 模型: models/unet/z-image-turbo-Q4_K_M.gguf
#       models/text_encoders/Qwen3-4B-Q5_K_M.gguf
#       models/vae/ae.safetensors

COMFY_HOME=/home/df/comfyui-server
VENV=$COMFY_HOME/venv
PORT=3011
LOG=$COMFY_HOME/comfyui.log

if curl -s --noproxy '*' -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/system_stats"; then
  echo "ComfyUI 已在运行: http://127.0.0.1:${PORT}"
  exit 0
fi

if [ ! -f "$VENV/bin/python" ]; then
  echo "venv 不存在,请先完成安装:"
  echo "  python3 -m venv $VENV"
  echo "  $VENV/bin/pip install torch torchvision torchaudio"
  echo "  $VENV/bin/pip install -r $COMFY_HOME/ComfyUI/requirements.txt"
  exit 1
fi

# 剥离代理环境变量,避免本机回环请求被代理劫持
nohup env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY \
  "$VENV/bin/python" "$COMFY_HOME/ComfyUI/main.py" \
  --listen 127.0.0.1 --port "$PORT" \
  >> "$LOG" 2>&1 &

echo "ComfyUI 启动中: http://127.0.0.1:${PORT} (日志: $LOG)"
echo "健康检查: curl http://127.0.0.1:${PORT}/system_stats"
