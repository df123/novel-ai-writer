# 2026-09-08 AI 插画功能交付交接

> 写给下一台电脑/下一个会话的 ZCode:读完本文 + AGENTS.md 即可接上上下文。
> **当前代码尚未 commit/push**,换机器使用前必须先推送 GitHub(见文末待办)。

## 一、本次会话完成的工作(按时间序)

1. **红点提示**(已提交推送):LLM 工具修改时间线/角色/杂项/主旨后,对应入口显示红点,点击消失。实现:`src/renderer/stores/changeFlagStore.ts`(localStorage `llm-change-flags-v1`)。
2. **git 风格版本比对**(已提交推送):基于数据库 `*_versions` 历史版本表做任意版本两两对比(不是一次性快照)。实现:`src/renderer/utils/diff.ts`(LCS 行级 diff + 上下文折叠 + 忽略空白,默认开)、`src/renderer/components/ChangeDiffDialog.vue`(el-scrollbar 用 max-height 属性,不要用 CSS)。
3. **外层对比入口**(已提交推送):列表悬浮操作和查看器直接进对比,不用打开历史弹窗。
4. **语音输入 FunASR**(已提交推送):本地 GPU Docker 部署 SenseVoice,端口 3010。前端 MediaRecorder 录音 → 转 16k PCM WAV → 后端转发 FunASR OpenAI 兼容接口。官方 Dockerfile 缺 torch,自写了 `Dockerfile.cuda`。文档:`docs/guides/VOICE_INPUT.md`。
5. **AI 插画**(**本次未提交**):本地 ComfyUI + Z-Image-Turbo GGUF 生图,详见下节。

## 二、AI 插画功能(未提交部分)

### 功能形态
主界面工具栏图片按钮 → 画廊弹窗(按章节筛选/大图预览/删除/重绘)→「生成插画」子弹窗:关联章节、画面数量(1-5)、画风后缀(默认"东方玄幻,水墨质感,电影级光影")、尺寸(1024²/1024×1536/1536×1024)、画面提示词列表(「AI 提取场景」用当前 LLM 读章节正文生成 3-5 条 60-120 字场景描述,可手动增删改)。逐张顺序生成,每张约 54 秒。

### 文件清单(全部未提交)
- `src/server/routes/illustrations.ts`(新增):ComfyUI API 集成。GET /status、POST /generate(工作流:UnetLoaderGGUF + CLIPLoaderGGUF type:'qwen_image' + VAELoader + KSampler steps:8 cfg:1.0 euler/simple;poll /history → /view 取图;存 `~/.novel-ai-writer/illustrations/<id>.png` + 入库)、GET /、GET /image/:id、DELETE /:id。设置键 `illustration_base_url` 默认 `http://127.0.0.1:3011`
- `src/server/db/schema.ts`:illustrations 表(project_id CASCADE、chapter_id SET NULL)
- `src/shared/types.ts`:Illustration / DbIllustration
- `src/server/index.ts`:注册路由 /api/illustrations
- `src/renderer/utils/api.ts`:illustrationApi(generate 超时 600s)
- `src/renderer/utils/llmExtract.ts`(新增):extractScenePrompts SSE 流式聚合 + JSON 解析
- `src/renderer/components/IllustrationPanel.vue`(新增):画廊 + 生成弹窗
- `src/renderer/components/MainLayout.vue`:Picture 图标入口
- `scripts/start_comfyui.sh`(新增):nohup 启动已剥离代理环境变量,curl 检查用 `--noproxy '*'`
- `docs/guides/ILLUSTRATION.md`:架构/部署文档

### 硬性参数(不要改)
CFG 必须 1.0(蒸馏模型,调高烧图);euler+simple;denoise 1.0;步数 8(可降 4 提速)。

## 三、本机部署状态(WSL2,**不可随代码迁移**)

| 组件 | 位置 | 端口 | 启动方式 |
|---|---|---|---|
| 后端 API | 仓库 `pnpm dev` | 3002 | `nohup pnpm dev >> logs/dev.log 2>&1 &` |
| 前端渲染器 | 同上 | 3004 | 同上 |
| FunASR Docker | 镜像 `funasr-api:local`,容器 `funasr-api` | 3010 | Docker 自启(--restart unless-stopped) |
| ComfyUI | `/home/df/comfyui-server/`(venv + ComfyUI 源码 + custom_nodes/ComfyUI-GGUF) | 3011 | `./scripts/start_comfyui.sh`(**不自启**) |

模型(共约 8.3GB,来自 ModelScope):
- `models/unet/z-image-turbo-Q4_K_M.gguf`(5GB)
- `models/text_encoders/Qwen3-4B-Q5_K_M.gguf`(2.9GB)
- `models/vae/ae.safetensors`(335MB)

GPU 8GB(FunASR 常驻约 1.2GB,ComfyUI 实际可用约 5.9GB)。

## 四、重要运维教训(必读)

1. **WSL 内存事故**:旧内存上限下,ComfyUI 冷加载生图使总内存超限 → 内核疯狂读写 swap vhdx(200MB/s)→ WSL 假死,一次生图拖到 749 秒。**用户已把 WSL 内存提到 32GB**,重测峰值 17Gi/31Gi 正常。另一台电脑部署前确认 WSL 内存 ≥ 24GB。
2. ComfyUI 常驻内存缓存约 7GB(保证热生图快);长时间不用可杀进程释放。
3. shell 配置了代理(127.0.0.1:10079),**所有 localhost curl 必须 `--noproxy '*'`**,否则被代理劫持导致误判。
4. pip 走代理会卡死:`env -u https_proxy -u http_proxy pip install -i https://pypi.tuna.tsinghua.edu.cn/simple`。
5. 模型下载用 ModelScope(国内 ~7MB/s),hf-mirror 会被限速到 0。
6. 不要在后台任务命令里写 `rm -rf` 大目录;不要用 `pkill -f` 匹配含自身命令字符串的模式。
7. 冷启动首次生图约 1 分钟密集磁盘读(加载模型),属正常。

## 五、安全约束(继续有效)

- **test33 项目(ID 89b46413-560e-4422-bd26-57a33fdfe29e / 聊天 f840d001-5621-492d-b020-8490fe68780c)绝对不能修改/删除/发测试消息,只允许只读查询。**
- 未经用户明确确认,禁止 OpenRouter / OpenCode Zen(`opencode/`)付费模型真实调用;免费模型可测。
- CLI Proxy 真实调用测试仅允许 `cliproxy/gpt-5.6-luna`。
- OpenCode Go(`opencode-go/`)、DeepSeek、Z.AI 不受上述限制。
- API 密钥 AES-256-CBC 加密存储,输出时掩码。
- 获取模型列表/价格不算真实调用,但不得触发推理。

## 六、验证状态

- E2E 全链路通过:建临时项目 → 生成 54s → 图片接口返回有效 PNG 1024²(1.5MB)→ 列表/删除/级联清理正常,测试数据已清干净
- `pnpm typecheck` / `pnpm lint` / `pnpm build` 全部通过

## 七、待办

1. **commit + push GitHub**(等用户明确指示;`docs/handoff/` 目录本身也是未跟踪状态,历史上一直没提交)
2. 可选改进:固定种子复现、步数选择、更多尺寸档、ComfyUI `--listen 0.0.0.0` 以供局域网另一台电脑调用 `illustration_base_url`
3. 换机提示:另一台电脑 ZCode 会话/记忆不共享,靠 GitHub 代码 + 本文档交接;ComfyUI/FunASR 需在新机重新部署(或把 `illustration_base_url` 指向本机局域网 IP,需先改 ComfyUI 监听地址)
