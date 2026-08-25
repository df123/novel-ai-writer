# LLM 提供商扩展实现说明

## 背景

在原有 DeepSeek 与 OpenRouter 支持基础上，参考 `df-ai-stock` 的 provider 路由实现，新增：

- Z.AI Coding Plan
- OpenCode Zen / OpenCode Go
- CLI Proxy API

## 后端路由

模型 ID 使用前缀区分 OpenCode 与 CLI Proxy API 的实际上游端点：

| 提供商 | 模型 ID 形式 | 端点 |
| --- | --- | --- |
| Z.AI | `glm-5.3`、`glm-5.2` | `https://api.z.ai/api/coding/paas/v4/chat/completions` |
| OpenCode Zen | `opencode/<model>` | `https://opencode.ai/zen/v1/chat/completions` |
| OpenCode Go | `opencode-go/<model>` | `https://opencode.ai/zen/go/v1/chat/completions` |
| CLI Proxy API | `cliproxy/<model>` | `<CLIPROXY_BASE_URL>/chat/completions` |

OpenCode 中仅支持 Responses API 的模型会自动改用对应 Zen / Go `/responses` 端点，并把响应事件转换为前端已有的 Chat Completions 流格式。

## 请求差异

- Z.AI Coding Plan：
  - 伪装 `opencode/1.17.7` User-Agent
  - 生成并复用进程级 `ses_<ULID>` 会话亲和 ID
  - 默认开启 `thinking`，并保留跨轮思考上下文
  - GLM-5.2 及以上可配置 `reasoning_effort: max/xhigh/high/medium/low/minimal/none`
  - 单次输出上限 32000 tokens
- OpenCode Zen / Go：
  - 单次输出上限 32000 tokens
  - 可配置 `reasoning_effort`
  - Hy3 的通用强度会映射为 `no_think/low/high`
- CLI Proxy API：
  - Base URL 可配置，默认 `http://127.0.0.1:8317/v1`
  - 模型列表来自 `/models`
  - 可配置 `reasoning_effort: auto/none/low/medium/high`

## 设置项

所有 API 密钥仍沿用 settings 表的加密存储规则：

- `zai_api_key`
- `zai_reasoning_enabled`
- `zai_reasoning_effort`
- `opencode_api_key`
- `cliproxy_api_key`
- `cliproxy_base_url`
- `opencode_reasoning_enabled`
- `opencode_reasoning_effort`
- `cliproxy_reasoning_enabled`
- `cliproxy_reasoning_effort`

前端设置弹窗提供对应输入、Base URL 和推理强度配置。写作区提供商下拉框新增 Z.AI、OpenCode（Zen/Go）和 CLI Proxy API；OpenCode 模型下拉项会标明来源端点。

Z.AI 模型列表仅保留 GLM-5.2 及以上，当前包含 GLM-5.3 与 GLM-5.2。思考强度默认 `max`；Coding Plan 端点会把通用枚举映射为上游实际支持的强度。GLM-5.3 不支持关闭思考，`none/minimal/low` 会映射为 `low`；GLM-5.2 的 `none/minimal` 会停止思考。

参考文档：[Z.AI Deep Thinking](https://docs.z.ai/guides/capabilities/thinking)
