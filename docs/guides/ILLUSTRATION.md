# AI 插画功能(本地 Z-Image-Turbo)

基于本地 ComfyUI + 阿里通义 Z-Image-Turbo(GGUF 量化)的小说插画生成,GPU 加速,完全离线、免费。LLM 从章节内容提取画面提示词,生图模型出图,统一画风后缀保持全书一致。

## 架构

```
章节内容 ──LLM(现有 /api/llm/chat,前端流式)──→ 画面提示词列表(可编辑)
                                                      ↓ 逐张生成
浏览器 ←─ PNG ←─ Express :3002 /api/illustrations/generate
                                                      ↓ ComfyUI API(/prompt + /history 轮询)
                                        ComfyUI :3011(GPU, Z-Image-Turbo FP8)
                                                      ↓
                     插画存档 ~/.novel-ai-writer/illustrations/<id>.png
                     DB illustrations 表记录元数据(项目/章节/提示词/尺寸)
```

- 生成参数:8 步蒸馏采样(Turbo)、CFG 1、euler/simple、1024×1024 / 1024×1536 / 1536×1024
- 6GB 显存配置:GGUF Q4_K_M 主模型(unsloth)+ Qwen3-4B-Q5_K_M GGUF 文本编码器 + 原版 VAE,ComfyUI 自动分阶段加载,ComfyUI-GGUF 插件提供 UnetLoaderGGUF/CLIPLoaderGGUF 节点

## 端口

| 服务 | 端口 |
|---|---|
| Express API | 3002 |
| Vite 渲染器 | 3004 |
| FunASR 语音 | 3010 |
| **ComfyUI 生图** | **3011** |

## 部署与启动

```bash
# 一次性安装(目录 /home/df/comfyui-server)
git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI/custom_nodes && git clone --depth 1 https://github.com/city96/ComfyUI-GGUF
python3 -m venv ../venv
../venv/bin/pip install torch torchvision torchaudio
../venv/bin/pip install -r ../ComfyUI/requirements.txt

# 模型(ModelScope 国内源,实测 ~7MB/s)
#   models/unet/z-image-turbo-Q4_K_M.gguf         (unsloth/Z-Image-Turbo-GGUF)
#   models/text_encoders/Qwen3-4B-Q5_K_M.gguf     (unsloth/Qwen3-4B-GGUF)
#   models/vae/ae.safetensors                      (Comfy-Org/z_image_turbo split_files/vae)

# 启动
./scripts/start_comfyui.sh
curl http://127.0.0.1:3011/system_stats   # 健康检查
```

WSL 重启后需重新执行 `./scripts/start_comfyui.sh`(模型常驻显存约 5~6GB,生图时与 FunASR 短时转写基本不冲突)。

## 后端接口

- `GET /api/illustrations/status` — ComfyUI 可用性
- `POST /api/illustrations/generate` — `{ projectId, chapterId?, prompt, width?, height? }` → 生成并存档
- `GET /api/illustrations?projectId=&chapterId=` — 列表
- `GET /api/illustrations/image/:id` — 图片文件
- `DELETE /api/illustrations/:id` — 删除(含文件)

服务地址可通过 settings 表 `illustration_base_url` 覆盖,默认 `http://127.0.0.1:3011`。

## 使用

顶栏"AI 插画"按钮 → 图库面板:按章节筛选浏览、点击看大图、相同提示词重新生成、删除。"生成插画"对话框:选章节 → AI 提取场景(可编辑)→ 选画风后缀与尺寸 → 逐张生成(显示进度)。

## 提示词与画风

- AI 提取场景由当前设置的 LLM 完成提示词(60~120 字画面描述:主体/动作/环境/光线/构图)
- "画风后缀"会附加到系统提示,建议全书统一(默认:东方玄幻,水墨质感,电影级光影)
- Z-Image 原生支持中文提示词与画面内汉字
