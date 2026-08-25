# LLM 提供商扩展实现说明

## 背景

在原有 DeepSeek 与 OpenRouter 支持基础上，参考 `df-ai-stock` 的 provider 路由实现，新增：

- Z.AI Coding Plan
- OpenCode Zen / OpenCode Go
- CLI Proxy API

## 后端路由

模型 ID 使用前缀区分 OpenCode 与 CLI Proxy API 的实际上游端点：

| 提供商 | 模型 ID 形式 | Responses 优先端点 | Chat Completions 回退端点 |
| --- | --- | --- | --- |
| DeepSeek | `deepseek-v4-flash`、`deepseek-v4-pro` | `https://api.deepseek.com/responses` | `https://api.deepseek.com/v1/chat/completions` |
| OpenRouter | `<vendor>/<model>` | `https://openrouter.ai/api/v1/responses` | `https://openrouter.ai/api/v1/chat/completions` |
| Z.AI | `glm-5.3`、`glm-5.2` | `https://api.z.ai/api/coding/paas/v4/responses` | `https://api.z.ai/api/coding/paas/v4/chat/completions` |
| OpenCode Zen | `opencode/<model>` | `https://opencode.ai/zen/v1/responses` | `https://opencode.ai/zen/v1/chat/completions` |
| OpenCode Go | `opencode-go/<model>` | `https://opencode.ai/zen/go/v1/responses` | `https://opencode.ai/zen/go/v1/chat/completions` |
| CLI Proxy API | `cliproxy/<model>` | `<CLIPROXY_BASE_URL>/responses` | `<CLIPROXY_BASE_URL>/chat/completions` |

所有提供商先请求 Responses 端点。若端点或模型返回 `400/404/405/410/415/500/501/502/503/504`，且响应尚未开始输出，后端会记录警告并改用 Chat Completions；认证、额度、限流等错误不会触发重复请求。OpenCode 不再依赖静态协议模型集合决定请求格式，静态集合仅用于模型列表过滤。

## Responses API 转换

Responses 请求面向本项目的长上下文与高频工具调用场景保留完整历史：

- 多条 `system` 消息合并为顶层 `instructions`
- 历史 assistant `tool_calls` 转换为 `function_call` 输入项
- 历史 `tool` 消息转换为 `function_call_output`，并用同一 `call_id` 关联
- Chat 工具定义从 `{ type, function }` 转换为 Responses 的扁平 function tool
- 其余 user / assistant / developer 历史按顺序保留在 `input`

后端会把 Responses SSE 中的文本、思考文本、function call 增量和 usage 事件转换为前端已有的 Chat Completions SSE 格式，前端无需感知上游协议。除标准增量事件外，也兼容只在 `output_item.done` / `function_call_arguments.done` 中给出完整工具参数的代理，避免工具参数丢失。

## 请求差异

- DeepSeek：
  - Responses 请求使用 `reasoning: { effort }`
  - Chat Completions 回退请求沿用 `thinking` 与 `reasoning_effort`
- OpenRouter：
  - Responses 请求保持无状态，不发送 `store` 或 `previous_response_id`
  - 完整历史每次随 `input` 重新提交
- Z.AI Coding Plan：
  - 伪装 `opencode/1.17.7` User-Agent
  - 生成并复用进程级 `ses_<ULID>` 会话亲和 ID
  - Responses 请求使用 `reasoning: { effort }`；Chat 回退请求默认开启 `thinking`
  - GLM-5.2 及以上可配置 `max/xhigh/high/medium/low/minimal/none`
  - 单次输出上限 32000 tokens
- OpenCode Zen / Go：
  - 单次输出上限 32000 tokens
  - Responses 请求使用标准 `reasoning: { effort: low/high }`，`none` 不发送 reasoning
  - Chat 回退请求使用 `reasoning_effort`，Hy3 会映射为 `no_think/low/high`
- CLI Proxy API：
  - Base URL 可配置，默认 `http://127.0.0.1:8317/v1`
  - 模型列表来自 `/models`
  - Responses 请求使用 `reasoning: { effort }`
  - Chat Completions 回退请求使用 `reasoning_effort: auto/none/low/medium/high`

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
