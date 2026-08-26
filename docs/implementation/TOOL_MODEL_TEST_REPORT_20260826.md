# 全模型工具调用测试报告（2026-08-26）

## 测试范围

测试时项目下拉列表中仅保留 `test33`。所有会写入数据的工具测试都在独立临时项目中执行，测试后临时项目已删除；`test33` 全量数据快照未变化。

- 测试的模型记录总数：**450**
- 发起真实 LLM 工具调用的模型数：**324**
- 真实调用中成功返回有效工具调用：**286**
- 真实调用成功率：**88.27%**
- 每次请求都携带完整 **13 个工具 schema**
- 目标工具：`get_timeline`
- CLI Proxy API 严格只测试：`cliproxy/gpt-5.6-luna`

本次模型测试判断的是：模型能否接受全部 13 个工具定义，并返回一个本项目可识别的有效工具调用。它不是 13 个工具 × 每个模型的完整笛卡尔积；每个模型发起一次包含全部工具定义的真实调用，目标为 `get_timeline`。本地工具执行链路则对 13 个工具分别做了实际 API 测试。

## 工具清单与本地执行结果

| 工具 | API 执行结果 |
| --- | --- |
| `create_timeline` | 通过 |
| `update_timeline` | 通过 |
| `delete_timeline` | 通过 |
| `get_timeline` | 通过 |
| `create_character` | 通过 |
| `update_character` | 通过 |
| `delete_character` | 通过 |
| `get_character` | 通过 |
| `update_theme` | 通过：首次自动创建 v1，再更新到 v2 |
| `create_misc_record` | 通过 |
| `update_misc_record` | 通过 |
| `delete_misc_record` | 通过 |
| `get_misc_record` | 通过 |

## 提供商总结

| 提供商 | 模型记录 | 真实调用通过 | 结论 |
| --- | ---: | ---: | --- |
| DeepSeek | 2 | 2 | 全部可用 |
| Z.AI | 2 | 2 | 全部可用 |
| OpenCode | 34 | 19 | 19 个可用；15 个因余额、上游或格式支持不可用 |
| CLI Proxy API | 1 | 1 | 按限制仅测试 `gpt-5.6-luna`，可用 |
| OpenRouter | 411 | 262 | 262 个交互式模型可用；另有 66 个官方标记不支持 tools、60 个仅 Batch、5 个行为失败、18 个请求失败 |

### DeepSeek 可用模型

- `deepseek-v4-flash`
- `deepseek-v4-pro`

### Z.AI 可用模型

- `glm-5.3`
- `glm-5.2`

### OpenCode 可用模型

- `opencode/big-pickle`
- `opencode/muse-spark-1.2-contributor-free`
- `opencode/mimo-v2.5-free`
- `opencode/nemotron-3-ultra-free`
- `opencode/laguna-s-2.1-free`
- `opencode-go/kimi-k2.7-code`
- `opencode-go/kimi-k2.6`
- `opencode-go/glm-5.2`
- `opencode-go/glm-5.3`
- `opencode-go/ox-alpha-free`
- `opencode-go/glm-5.1`
- `opencode-go/deepseek-v4-pro`
- `opencode-go/deepseek-v4-flash`
- `opencode-go/mimo-v2.5-pro`
- `opencode-go/mimo-v2.5`
- `opencode-go/hy3`
- `opencode-go/gpt-5.6-luna`
- `opencode-go/grok-4.5`
- `opencode-go/muse-spark-1.2-contributor`

### OpenCode 不可用模型及原因

- `opencode/muse-spark-1.2`：OpenCode 余额不足
- `opencode/deepseek-v4-pro`：OpenCode 余额不足
- `opencode/deepseek-v4-flash`：OpenCode 余额不足
- `opencode/glm-5.2`：OpenCode 余额不足
- `opencode/glm-5.1`：OpenCode 余额不足
- `opencode/glm-5`：OpenCode 余额不足
- `opencode/minimax-m3`：OpenCode 余额不足
- `opencode/minimax-m2.7`：OpenCode 余额不足
- `opencode/minimax-m2.5`：OpenCode 余额不足
- `opencode/kimi-k3`：OpenCode 余额不足
- `opencode/kimi-k2.7-code`：OpenCode 余额不足
- `opencode/kimi-k2.6`：OpenCode 余额不足
- `opencode/kimi-k2.5`：OpenCode 余额不足
- `opencode/deepseek-v4-flash-free`：上游模型不可用
- `opencode-go/kimi-k3`：Go endpoint 不支持该模型的 OpenAI 格式

### CLI Proxy API

- `cliproxy/gpt-5.6-luna`

未测试 CLI Proxy 的其他任何模型，符合“只允许使用 5.6 Luna”的限制。

## OpenRouter 结果

OpenRouter 当前项目模型列表共有 411 条记录：

- `262` 个通过真实工具调用测试
- `18` 个请求失败
- `5` 个模型可用但未正确返回工具调用
- `66` 个由 OpenRouter 官方元数据标记为不支持 `tools`，未发起无效请求
- `60` 个为 `:batch` 模型，不适合当前实时交互流式调用，未发起请求

交互式、官方标记支持 tools 的 OpenRouter 模型共 285 个，其中 262 个通过，通过率 **91.93%**。

### OpenRouter 通过的模型

- `stealth/ox-alpha`
- `~z-ai/glm-latest`
- `z-ai/glm-5.3`
- `qwen/qwen3.8-27b`
- `dots-studio/dots-3-note-preview:free`
- `google/gemini-3.7-flash`
- `bytedance-seed/seed-2-1-turbo`
- `qwen/qwen3.8-2.4t-a95b`
- `bytedance-seed/seed-2.0-code`
- `deepseek/deepseek-v4-pro-0813`
- `x-ai/grok-4.6`
- `nvidia/nemotron-3.5-lightning`
- `nvidia/nemotron-3.5-lightning:free`
- `upstage/solar-pro4`
- `meta/muse-glimmer-30b`
- `qwen/qwen3.8-max`
- `~deepseek/deepseek-v4-flash-latest`
- `deepseek/deepseek-v4-flash-0731`
- `thinkingmachines/inkling-small`
- `qwen/qwen3.7-flash`
- `anthropic/claude-opus-5-fast`
- `anthropic/claude-opus-5`
- `inclusionai/ling-3.0-flash`
- `poolside/laguna-s-2.1`
- `poolside/laguna-s-2.1:free`
- `google/gemini-3.6-flash`
- `google/gemini-3.5-flash-lite`
- `meituan/longcat-2.0`
- `thinkingmachines/inkling`
- `moonshotai/kimi-k3`
- `kwaipilot/kat-coder-air-v2.5`
- `kwaipilot/kat-coder-pro-v2.5`
- `openai/gpt-5.6-luna-pro`
- `openai/gpt-5.6-luna`
- `openai/gpt-5.6-terra-pro`
- `openai/gpt-5.6-terra`
- `openai/gpt-5.6-sol-pro`
- `openai/gpt-5.6-sol`
- `x-ai/grok-4.5`
- `~x-ai/grok-latest`
- `aion-labs/aion-3.0-mini`
- `aion-labs/aion-3.0`
- `tencent/hy3`
- `poolside/laguna-xs-2.1`
- `poolside/laguna-xs-2.1:free`
- `anthropic/claude-sonnet-5`
- `nex-agi/nex-n2-mini`
- `sakana/fugu-ultra`
- `google/gemini-3-pro-image`
- `cohere/north-mini-code:free`
- `z-ai/glm-5.2`
- `z-ai/glm-5.2:free`
- `moonshotai/kimi-k2.7-code`
- `~anthropic/claude-fable-latest`
- `anthropic/claude-fable-5`
- `nex-agi/nex-n2-pro`
- `nvidia/nemotron-3-ultra-550b-a55b`
- `nvidia/nemotron-3-ultra-550b-a55b:free`
- `qwen/qwen3.7-plus`
- `minimax/minimax-m3`
- `minimax/minimax-m3:free`
- `stepfun/step-3.7-flash`
- `anthropic/claude-opus-4.8-fast`
- `anthropic/claude-opus-4.8`
- `qwen/qwen3.7-max`
- `x-ai/grok-build-0.1`
- `google/gemini-3.5-flash`
- `google/gemini-3.1-flash-lite`
- `openai/gpt-chat-latest`
- `x-ai/grok-4.3`
- `ibm-granite/granite-4.1-8b`
- `mistralai/mistral-medium-3-5`
- `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
- `~anthropic/claude-haiku-latest`
- `~openai/gpt-mini-latest`
- `~google/gemini-pro-latest`
- `~moonshotai/kimi-latest`
- `~google/gemini-flash-latest`
- `~anthropic/claude-sonnet-latest`
- `~openai/gpt-latest`
- `qwen/qwen3.5-plus-20260420`
- `qwen/qwen3.6-flash`
- `qwen/qwen3.6-max-preview`
- `qwen/qwen3.6-27b`
- `openai/gpt-5.5-pro`
- `openai/gpt-5.5`
- `deepseek/deepseek-v4-pro`
- `deepseek/deepseek-v4-flash`
- `tencent/hy3-preview`
- `xiaomi/mimo-v2.5-pro`
- `xiaomi/mimo-v2.5`
- `~anthropic/claude-opus-latest`
- `moonshotai/kimi-k2.6`
- `anthropic/claude-opus-4.7`
- `z-ai/glm-5.1`
- `google/gemma-4-26b-a4b-it`
- `google/gemma-4-31b-it`
- `qwen/qwen3.6-plus`
- `z-ai/glm-5v-turbo`
- `arcee-ai/trinity-large-thinking`
- `x-ai/grok-4.20`
- `kwaipilot/kat-coder-pro-v2`
- `rekaai/reka-edge`
- `minimax/minimax-m2.7`
- `minimax/minimax-m2.7:free`
- `openai/gpt-5.4-nano`
- `openai/gpt-5.4-mini`
- `mistralai/mistral-small-2603`
- `z-ai/glm-5-turbo`
- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/nemotron-3-super-120b-a12b:free`
- `bytedance-seed/seed-2.0-lite`
- `qwen/qwen3.5-9b`
- `openai/gpt-5.4-pro`
- `openai/gpt-5.4`
- `inception/mercury-2`
- `google/gemini-3.1-flash-lite-preview`
- `bytedance-seed/seed-2.0-mini`
- `qwen/qwen3.5-35b-a3b`
- `qwen/qwen3.5-27b`
- `qwen/qwen3.5-122b-a10b`
- `qwen/qwen3.5-flash-02-23`
- `google/gemini-3.1-pro-preview-customtools`
- `openai/gpt-5.3-codex`
- `aion-labs/aion-2.0`
- `anthropic/claude-sonnet-4.6`
- `qwen/qwen3.5-plus-02-15`
- `qwen/qwen3.5-397b-a17b`
- `minimax/minimax-m2.5`
- `z-ai/glm-5`
- `qwen/qwen3-max-thinking`
- `anthropic/claude-opus-4.6`
- `qwen/qwen3-coder-next`
- `stepfun/step-3.5-flash`
- `moonshotai/kimi-k2.5`
- `upstage/solar-pro-3`
- `z-ai/glm-4.7-flash`
- `openai/gpt-5.2-codex`
- `bytedance-seed/seed-1.6-flash`
- `bytedance-seed/seed-1.6`
- `minimax/minimax-m2.1`
- `z-ai/glm-4.7`
- `google/gemini-3-flash-preview`
- `nvidia/nemotron-3-nano-30b-a3b`
- `openai/gpt-5.2-pro`
- `openai/gpt-5.2`
- `mistralai/devstral-2512`
- `relace/relace-search`
- `z-ai/glm-4.6v`
- `openai/gpt-5.1-codex-max`
- `amazon/nova-2-lite-v1`
- `mistralai/ministral-14b-2512`
- `mistralai/ministral-8b-2512`
- `mistralai/ministral-3b-2512`
- `mistralai/mistral-large-2512`
- `deepseek/deepseek-v3.2`
- `anthropic/claude-opus-4.5`
- `openai/gpt-5.1`
- `openai/gpt-5.1-codex`
- `openai/gpt-5.1-codex-mini`
- `moonshotai/kimi-k2-thinking`
- `amazon/nova-premier-v1`
- `mistralai/voxtral-small-24b-2507`
- `openai/gpt-oss-safeguard-20b`
- `minimax/minimax-m2`
- `qwen/qwen3-vl-32b-instruct`
- `anthropic/claude-haiku-4.5`
- `qwen/qwen3-vl-8b-thinking`
- `qwen/qwen3-vl-8b-instruct`
- `qwen/qwen3-vl-30b-a3b-thinking`
- `qwen/qwen3-vl-30b-a3b-instruct`
- `z-ai/glm-4.6`
- `anthropic/claude-sonnet-4.5`
- `deepseek/deepseek-v3.2-exp`
- `qwen/qwen3-vl-235b-a22b-thinking`
- `qwen/qwen3-vl-235b-a22b-instruct`
- `qwen/qwen3-max`
- `qwen/qwen3-coder-plus`
- `deepseek/deepseek-v3.1-terminus`
- `qwen/qwen3-coder-flash`
- `qwen/qwen3-next-80b-a3b-thinking`
- `qwen/qwen3-next-80b-a3b-instruct`
- `qwen/qwen-plus-2025-07-28`
- `moonshotai/kimi-k2-0905`
- `qwen/qwen3-30b-a3b-thinking-2507`
- `deepseek/deepseek-chat-v3.1`
- `mistralai/mistral-medium-3.1`
- `z-ai/glm-4.5v`
- `openai/gpt-5`
- `openai/gpt-5-mini`
- `openai/gpt-5-nano`
- `openai/gpt-oss-120b`
- `openai/gpt-oss-20b`
- `anthropic/claude-opus-4.1`
- `mistralai/codestral-2508`
- `qwen/qwen3-coder-30b-a3b-instruct`
- `qwen/qwen3-30b-a3b-instruct-2507`
- `z-ai/glm-4.5`
- `z-ai/glm-4.5-air`
- `qwen/qwen3-235b-a22b-thinking-2507`
- `qwen/qwen3-coder`
- `google/gemini-2.5-flash-lite`
- `qwen/qwen3-235b-a22b-2507`
- `moonshotai/kimi-k2`
- `mistralai/mistral-small-3.2-24b-instruct`
- `minimax/minimax-m1`
- `google/gemini-2.5-flash`
- `google/gemini-2.5-pro`
- `openai/o3-pro`
- `google/gemini-2.5-pro-preview`
- `deepseek/deepseek-r1-0528`
- `anthropic/claude-opus-4`
- `anthropic/claude-sonnet-4`
- `mistralai/mistral-medium-3`
- `google/gemini-2.5-pro-preview-05-06`
- `qwen/qwen3-30b-a3b`
- `qwen/qwen3-8b`
- `qwen/qwen3-14b`
- `qwen/qwen3-32b`
- `qwen/qwen3-235b-a22b`
- `openai/o4-mini-high`
- `openai/o3`
- `openai/o4-mini`
- `openai/gpt-4.1`
- `openai/gpt-4.1-mini`
- `openai/gpt-4.1-nano`
- `meta-llama/llama-4-maverick`
- `meta-llama/llama-4-scout`
- `deepseek/deepseek-chat-v3-0324`
- `google/gemma-3-12b-it`
- `google/gemma-3-27b-it`
- `mistralai/mistral-saba`
- `openai/o3-mini-high`
- `qwen/qwen-plus`
- `openai/o3-mini`
- `deepseek/deepseek-r1`
- `deepseek/deepseek-chat`
- `openai/o1`
- `meta-llama/llama-3.3-70b-instruct`
- `amazon/nova-lite-v1`
- `amazon/nova-micro-v1`
- `amazon/nova-pro-v1`
- `openai/gpt-4o-2024-11-20`
- `mistralai/mistral-large-2407`
- `qwen/qwen-2.5-7b-instruct`
- `qwen/qwen-2.5-72b-instruct`
- `cohere/command-r-08-2024`
- `cohere/command-r-plus-08-2024`
- `openai/gpt-4o-2024-08-06`
- `mistralai/mistral-nemo`
- `openai/gpt-4o-mini`
- `openai/gpt-4o-mini-2024-07-18`
- `openai/gpt-4o`
- `openai/gpt-4o-2024-05-13`
- `mistralai/mixtral-8x22b-instruct`
- `openai/gpt-4-turbo`
- `anthropic/claude-3-haiku`
- `mistralai/mistral-large`
- `openai/gpt-3.5-turbo-0613`
- `openai/gpt-3.5-turbo-16k`
- `openai/gpt-3.5-turbo`
- `openai/gpt-4`

### OpenRouter 请求失败

- ``meta/muse-spark-1.2-contributor`：数据策略/隐私限制下无可用 endpoint`
- ``deepseek/deepseek-v4-flash-vision-exp`：数据策略/隐私限制下无可用 endpoint`
- ``liquid/lfm-2.5-2.6b:free`：上游暂时不可用`
- ``sakana/sakana-namazu`：数据策略/隐私限制下无可用 endpoint`
- ``meta/muse-spark-1.2`：需要 OpenRouter 18+ 确认`
- ``thinkingmachines/inkling-small:free`：仅限指定 agentic harness`
- ``thinkingmachines/inkling:free`：仅限指定 agentic harness`
- ``meta/muse-spark-1.1`：需要 OpenRouter 18+ 确认`
- ``anthropic/claude-opus-4.7-fast`：Anthropic 上游不支持 speed 参数`
- ``google/gemma-4-26b-a4b-it:free`：上游临时限流`
- ``google/gemma-4-31b-it:free`：上游临时限流`
- ``openai/gpt-audio`：文本工具测试不满足音频输入/输出模态要求`
- ``openai/gpt-audio-mini`：文本工具测试不满足音频输入/输出模态要求`
- ``openai/gpt-5.2-chat`：无可用 endpoint`
- ``arcee-ai/virtuoso-large`：需要专用 serverless endpoint`
- ``thedrummer/unslopnemo-12b`：上游未启用 auto tool choice`
- ``sao10k/l3.1-euryale-70b`：上游明确不支持 function calling`
- ``openai/gpt-4-turbo-preview`：模型不存在或当前账号无权限`

### OpenRouter 行为失败

- ``qwen/qwen3.6-35b-a3b`：未返回 tool call，仅返回文本`
- ``google/gemini-3.1-pro-preview`：未返回 tool call，仅返回文本`
- ``openai/gpt-5-pro`：未返回 tool call，仅返回文本`
- ``meta-llama/llama-3.1-70b-instruct`：未返回 tool call，仅返回文本`
- ``meta-llama/llama-3.1-8b-instruct`：返回的工具参数 JSON 无效（`{}{}`）`

## 数据完整性

- 测试前项目列表仅剩：`test33`
- 全部测试后项目列表仍仅剩：`test33`
- `test33` 数据快照 SHA-256：`9d32347e22366269622a0f5641a1bec95072dfc5912c4aa13c8b92796778270f`
- 测试后快照相同：`9d32347e22366269622a0f5641a1bec95072dfc5912c4aa13c8b92796778270f`
- `test33` 聊天数：1
- `test33` 消息数：16
- 临时测试项目已删除

## 注意事项

- 模型可用性是瞬时状态，余额、上游限流、endpoint 可用性和 OpenRouter 数据策略都会导致后续结果变化。
- `:batch` 模型不适合本项目的实时聊天流式场景。
- 音频、图像或官方标记不支持工具的模型不能用于当前文本工具调用链路。
- OpenCode 付费模型的余额恢复后，之前因 `CreditsError` 失败的模型可以重新测试。
- 测试过程中没有把 API Key 写入报告或仓库。
