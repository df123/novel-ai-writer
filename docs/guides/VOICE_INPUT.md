# 语音输入功能(FunASR)

基于本地 FunASR(SenseVoice 模型)的语音转文字输入,GPU 加速,完全离线、免费。

## 架构

```
浏览器(Windows)                        WSL
┌──────────────────────┐   WAV 音频   ┌───────────────────┐    转发    ┌──────────────────┐
│ ChatPanel 麦克风按钮   │ ──────────→ │ Express :3002      │ ────────→ │ FunASR :3010      │
│ MediaRecorder 录音    │             │ /api/speech/       │           │ sensevoice(GPU)  │
│ 前端转 16kHz 单声道WAV │  ←────────── │  transcribe        │  ←──────  │ OpenAI 兼容接口    │
└──────────────────────┘    返回文本   └───────────────────┘    文本    └──────────────────┘
```

- 聊天输入框旁的麦克风按钮:点击开始录音(显示计时),再点结束并转写,文本插入光标位置
- 最长录音 120 秒,自动结束并转写
- 转写服务不可用时会给出行内提示

## 端口

| 服务 | 端口 |
|---|---|
| Express API | 3002 |
| Vite 渲染器 | 3004 |
| **FunASR** | **3010** |

## 部署与启动

镜像源码:`/home/df/funasr-server/examples/openai_api`(FunASR 官方仓库稀疏克隆)

```bash
# 首次构建 GPU 镜像(约 5-6GB,含 CUDA 版 torch)
cd /home/df/funasr-server/examples/openai_api
docker build -f Dockerfile.cuda -t funasr-api:local .

# 启动(WSL 重启后容器自动拉起,--restart unless-stopped)
./scripts/start_funasr.sh

# 健康检查
curl http://127.0.0.1:3010/health
```

注意:官方 `Dockerfile` 未显式安装 torch(新版 funasr 将其列为可选依赖),GPU 部署必须用本项目的 `Dockerfile.cuda`。

## 后端接口

- `GET /api/speech/status` — FunASR 服务状态(可用性/模型)
- `POST /api/speech/transcribe` — 请求体为 WAV 音频字节,返回 `{ text }`

服务地址可通过 settings 表 `speech_base_url` 覆盖,默认 `http://127.0.0.1:3010`。

## 前端要点

- `src/renderer/utils/audio.ts` — 录音控制器 + 任意浏览器音频转 16kHz 单声道 PCM WAV(FunASR 对 WAV 支持最稳)
- 麦克风权限要求安全上下文:`127.0.0.1:3004` 访问正常;若改用局域网 IP + HTTP 访问,浏览器会禁用麦克风,需配置 HTTPS

## 模型信息

SenseVoice-Small:中文 CER 约 7.8%(对比 Whisper-large-v3 的 20%),GPU 约 170x 实时速度,支持中/英/日/韩/粤语,自带标点。模型缓存在 `~/funasr-server/model-cache`(容器卷),重建容器不重复下载。
