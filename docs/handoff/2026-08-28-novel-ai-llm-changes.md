# novel-ai LLM 功能修改交接总结

> 交接日期：2026-08-28  
> 当前分支：`master`  
> 当前 HEAD：`0ceeed7`  
> 同步状态：与 `origin/master` 同步

本文档用于把本轮对话中的主要修改、行为规则、验证结果和后续注意事项交接给另一个 LLM / 编码代理。

## 1. 必须继续遵守的硬性约束

### 1.1 test33 绝对不能修改

```text
项目 ID：89b46413-560e-4422-bd26-57a33fdfe29e
聊天 ID：f840d001-5621-492d-b020-8490fe68780c
```

禁止：

- 修改 test33 数据
- 删除 test33 数据
- 在 test33 中发测试消息
- 用 test33 做写入型测试

如需分析 test33，只能只读查询。

### 1.2 禁止付费模型真实调用

未经用户明确确认，禁止真实推理调用：

- OpenRouter 付费模型
- OpenCode Zen 付费模型

允许真实调用：

- OpenRouter 免费模型
- OpenCode Zen 免费模型
- OpenCode Go
- DeepSeek
- Z.AI

CLI Proxy API 真实调用只允许：

```text
cliproxy/gpt-5.6-luna
```

获取模型列表、价格、元数据不算真实调用，但不得触发推理请求。

### 1.3 Z.AI 版本策略

只考虑 GLM-5.2 以上版本：

```text
glm-5.3
glm-5.2
```

动态模型列表会过滤低于 GLM-5.2 的模型。

### 1.4 Responses API 策略

所有 Provider 均优先 Responses API，只有明确不支持才回退 Chat Completions。

瞬时错误只重试，不换协议：

```text
408 / 425 / 429 / 500 / 502 / 503 / 504
```

明确不支持 Responses 的状态：

```text
404 / 405 / 410 / 415 / 501
```

某些 400 错误只有明确包含 unsupported / not supported / model_not_supported / unknown endpoint 等语义才回退。

不使用：

```text
previous_response_id
```

每次请求完整提交上下文，保持无状态。

## 2. LLM Provider 支持

当前支持：

```text
deepseek
openrouter
zai
opencode
cliproxy
```

核心文件：

```text
src/server/services/llmService.ts
src/server/config/index.ts
src/server/routes/llm.ts
src/renderer/components/LLMSettingsDialog.vue
src/renderer/stores/settingsStore.ts
src/renderer/stores/chatStore.ts
src/renderer/stores/chatStoreTypes.ts
src/renderer/utils/api.ts
src/shared/types.ts
README.md
docs/implementation/LLM_PROVIDER_EXPANSION.md
```

### 2.1 DeepSeek

```text
Responses: https://api.deepseek.com/responses
Chat: https://api.deepseek.com/v1/chat/completions
Models: https://api.deepseek.com/models
```

支持 Responses 优先、Chat 回退、动态模型、thinking、reasoning_effort。

### 2.2 OpenRouter

```text
Responses: https://openrouter.ai/api/v1/responses
Chat: https://openrouter.ai/api/v1/chat/completions
Models: https://openrouter.ai/api/v1/models
```

支持动态模型、免费模型识别、上下文窗口展示，不发送 `store` 和 `previous_response_id`。

### 2.3 Z.AI

```text
Chat: https://api.z.ai/api/coding/paas/v4/chat/completions
Responses: https://api.z.ai/api/v1/responses
Models: https://api.z.ai/api/coding/paas/v4/models
```

支持 GLM-5.2+，默认 `glm-5.3`。

思考强度：

```text
max / xhigh / high / medium / low / minimal / none
```

默认 `max`。

Responses：

```json
{ "reasoning": { "effort": "max" } }
```

Chat：

```json
{
  "thinking": {
    "type": "enabled",
    "clear_thinking": false
  }
}
```

伪装 UA：

```text
opencode/1.18.23
```

生成并复用进程级 `ses_<ULID>` 会话亲和 ID，相关 Header：

```text
User-Agent
X-Session-Id
x-session-affinity
```

### 2.4 OpenCode Zen / Go

模型前缀：

```text
opencode/
opencode-go/
```

Endpoints：

```text
Zen Responses: https://opencode.ai/zen/v1/responses
Zen Chat: https://opencode.ai/zen/v1/chat/completions
Go Responses: https://opencode.ai/zen/go/v1/responses
Go Chat: https://opencode.ai/zen/go/v1/chat/completions
```

支持动态模型、按官方能力路由协议、模型别名、免费标识、上下文窗口、推理强度。

推理映射：

```text
minimal -> low
low -> low
medium -> high
high -> high
max -> high
none -> 不发送 reasoning
```

Hy3：

```text
none -> no_think
```

### 2.5 CLI Proxy API

默认 Base URL：

```text
http://127.0.0.1:8317/v1
```

支持：

```text
<Base URL>/responses
<Base URL>/chat/completions
<Base URL>/models
```

支持 Base URL 配置、动态模型、Responses 优先、Chat 回退。

推理强度：

```text
auto / none / low / medium / high
```

## 3. 动态模型列表与缓存

- 各 Provider 支持动态 `/models`
- 下拉框不会每次打开都请求
- 模型列表缓存到本地
- 设置页提供手动刷新
- 保存 API Key / Base URL 后清理对应缓存
- 当前 Provider 匹配时自动刷新
- 静态模型只作为失败回退

模型信息：

```text
id
name
provider
contextWindow
price
```

OpenRouter 免费模型按价格为 0 或免费标记判断。OpenCode 免费 / 付费模型使用独立集合判断。

## 4. Responses 流式协议适配

前端继续消费类似 Chat Completions 的 delta：

```json
{
  "choices": [
    {
      "delta": {
        "content": "...",
        "reasoning_content": "...",
        "tool_calls": []
      }
    }
  ]
}
```

后端把 Responses SSE 转换为该格式。

已适配：

```text
response.output_text.delta
response.output_item.done
response.function_call_arguments.delta
response.function_call_arguments.done
response.content_part.done
response.completed
response.incomplete
usage 事件
function_call item
reasoning item
```

Responses 用量统一转换为 Chat 风格：

```json
{
  "prompt_tokens": 1,
  "completion_tokens": 2,
  "total_tokens": 3,
  "completion_tokens_details": {
    "reasoning_tokens": 4
  }
}
```

## 5. Responses SSE 事件内错误重试

相关提交：

```text
bb7260b fix: retry Responses stream failures
```

Z.AI 可能 HTTP 200，但 SSE 内返回 `response.failed`，例如：

```json
{
  "type": "response.failed",
  "response": {
    "error": {
      "code": "rate_limit_exceeded",
      "message": "Rate limit reached..."
    }
  }
}
```

现在会识别事件内瞬时错误：

```text
rate_limit_exceeded
timeout
api_timeout
server_error
internal_error
temporarily_overloaded
overloaded
```

未向浏览器输出内容时，自动重试 Responses：

```text
750ms
2500ms
6000ms
```

规则：

- 只重试 Responses
- 不回退 Chat
- 已输出内容则不重试，避免重复
- 重试耗尽后返回明确错误

## 6. 最大输出 Token

相关提交：

```text
faa26a4 fix: use maximum output token budget
```

Z.AI / OpenCode 输出上限：

```text
32000 tokens
```

旧默认 4096，新默认 32000。

Responses：

```json
{ "max_output_tokens": 32000 }
```

Chat：

```json
{ "max_tokens": 32000 }
```

其他 Provider 只有显式传 `maxTokens` 才设置输出上限。

## 7. Token 用量与上下文占比

相关提交：

```text
cfa9acf feat: 添加 Token Usage 追踪功能
9fb51ef feat: 基于真实用量显示上下文占比
26a53ef fix: 兼容 Responses 流式用量事件
```

当前行为：

- 不再用字符估算
- 从流式 usage 读取真实 token
- Responses / Chat 用量统一
- assistant 消息保存 usage
- UI 显示 prompt / completion / total / reasoning tokens
- 显示上下文占比与累计用量

上下文占比：

```text
真实 prompt tokens / 模型 context window
```

## 8. 只读查看与杂项记录窗口优化

相关提交：

```text
ca41351 feat: 新增内容只读查看模式
0ceeed7 feat: improve misc record viewer layout
```

新增：

```text
src/renderer/components/ContentViewerDialog.vue
```

用于时间线、人物、杂项记录。

杂项记录窗口：

```text
宽度：94vw，最大 1500px
高度：视口自适应，最大 980px
顶部：4vh
```

新增：

- 沉浸查看按钮
- 沉浸模式隐藏左侧列表
- 沉浸正文最大 1120px
- 普通正文最大 960px
- 字号 15px
- 行高 1.9
- 操作栏卡片化
- 左侧列表高度自适应
- 小屏响应式布局

1440×900 实测：

```text
普通模式内容区：约 1308 × 752
沉浸模式正文区：约 1266 × 710
```

## 9. 资料研究工具

相关提交：

```text
305c28f feat: add novel research tools
39c9442 fix: improve Z.AI research tool reliability
```

新增文件：

```text
src/server/services/researchService.ts
src/server/routes/research.ts
src/renderer/utils/researchResults.ts
src/renderer/components/ResearchResultCard.vue
docs/guides/RESEARCH_TOOLS.md
```

工具：

```text
web_search
read_web_page
search_wikipedia
read_wikipedia
get_historical_weather
search_books
```

数据源：

```text
Z.AI Web Search MCP
Z.AI Web Reader MCP
Wikipedia API
Open-Meteo Historical Weather
Open Library
```

未加入 Vision MCP 和 Zread MCP：一个无图片链路，一个主要面向 GitHub 仓库阅读。

### 9.1 Z.AI MCP 真实工具名

Web Search：

```text
Endpoint: https://api.z.ai/api/mcp/web_search_prime/mcp
Tool: web_search_prime
```

参数：

```json
{
  "search_query": "...",
  "content_size": "medium",
  "location": "cn"
}
```

Web Reader：

```text
Endpoint: https://api.z.ai/api/mcp/web_reader/mcp
Tool: webReader
```

参数：

```json
{
  "url": "...",
  "return_format": "markdown",
  "retain_images": false,
  "with_images_summary": false,
  "with_links_summary": false
}
```

### 9.2 后端 API

```text
POST /api/research/web-search
POST /api/research/web-reader
POST /api/research/wikipedia/search
POST /api/research/wikipedia
POST /api/research/weather
POST /api/research/books
```

### 9.3 设置项

```text
research_web_search_enabled
research_web_reader_enabled
research_wikipedia_enabled
research_weather_enabled
research_books_enabled
```

默认开启。无 Z.AI Key 时，Z.AI 搜索 / 阅读不暴露给模型，免费工具仍可用。

### 9.4 上下文保护

```text
搜索默认 6 条，最多 10 条
单条摘要最多 500 字符
网页正文默认 4000 字符，最多 12000 字符
Wikipedia 最多 8000 字符
历史天气最多 31 天
缓存 10 分钟
最多缓存 100 条
```

### 9.5 SSRF 防护

只允许 http / https，拒绝 localhost、内网 IP、链路本地、ULA、`.local`、`.internal`，以及解析到内网 IP 的域名。

### 9.6 URL 编码与 Reader 兼容

Z.AI 搜索可能出现双重百分号编码：

```text
%E5%94%90 -> %25E5%2594%2590
```

已用 `normalizeRepeatedPercentEncoding()` 修复。

实测：

```text
百度百科：可能失败
中文 Wikipedia：可能失败
知乎 / 搜狐：可成功
```

Reader 失败会透传具体错误；提示词要求模型不要重复读取同一个 URL，应换源或改用其他工具。

## 10. 数据与工具链路修复

相关提交：

```text
d7aaaf3 fix: 修复数据级联删除和工具调用链路
58e651c fix: 首次更新主旨时自动创建
```

主要修复：

- Vite `/api` 代理到 3002
- SQLite 启用并保持 `PRAGMA foreign_keys = ON`
- 项目删除真正级联
- 初始化时加载杂项记录
- 首次 `update_theme` 自动创建
- 自定义 SQL 返回 `{ results }`
- 数据库表白名单补齐
- DESC 排序兼容
- 数据库操作使用真实主键，`settings` 支持 `key`
- `update_timeline` 支持 `date`
- `get_character(description=...)` 本地字段过滤
- `get_misc_record(title=...)` 支持 title LIKE
- 流式 tool call 缺 id 时生成稳定 fallback id
- 项目导出过滤软删除数据
- 恢复章节前检查编号冲突
- 章节导出等待异步完成
- 保存 OpenRouter Key 后刷新模型列表

## 11. test33 中断问题结论

用户发送：

```text
那就是30万字吧
```

后 assistant 半途中断。

只读分析结论：

- 不是网络断流
- 不是 MCP 失败
- 不是 rate limit
- 模型保存 5653 字符后停在半句
- 当时默认输出上限 4096 tokens
- `response.incomplete` 未显式提示，导致看起来像正常结束

已通过 `faa26a4` 提高到 32000 tokens。

后续建议：解析 `response.incomplete.incomplete_details.reason`，若为 `max_output_tokens`，UI 明确提示“回复因达到最大输出长度被截断”。

## 12. 验证结果

最近全部通过：

```text
pnpm typecheck
pnpm typecheck:server
pnpm lint
pnpm build
```

lint 当前 0 errors，约 900 个既有格式 warning。

研究接口全部 HTTP 200。

Responses SSE 重试模拟：

```text
第一次返回 rate_limit_exceeded
自动重试
第二次成功
fetchCount = 2
```

最大输出 payload 检查：

```json
{ "max_output_tokens": 32000 }
```

## 13. 遗留事项

1. `response.incomplete` 截断原因尚未做 UI 提示
2. Z.AI Web Reader 对部分中文 URL 不兼容，已有错误透传与换源提示
3. 未设置 `ENCRYPTION_KEY`，当前使用机器指纹，Docker / WSL 重建后可能解密失败
4. 存在大量既有 lint warning，但无错误
5. 没有正式测试框架

## 14. 提交记录

```text
0ceeed7 feat: improve misc record viewer layout
faa26a4 fix: use maximum output token budget
bb7260b fix: retry Responses stream failures
39c9442 fix: improve Z.AI research tool reliability
305c28f feat: add novel research tools
26a53ef fix: 兼容 Responses 流式用量事件
c882e35 feat: DeepSeek 模型列表动态获取
7a8dbf1 feat: 动态获取并缓存模型列表
fed7ad2 fix: 同步 OpenCode Go 模型列表
9fb51ef feat: 基于真实用量显示上下文占比
ca41351 feat: 新增内容只读查看模式
6d769fc fix: 按官方协议优先使用 Responses API
a145888 fix: 提高 OpenCode 免费模型流式稳定性
d7aaaf3 fix: 修复数据级联删除和工具调用链路
3206121 docs: 限制付费模型真实调用测试
bcedc15 test: 记录全模型工具调用测试结果
58e651c fix: 首次更新主旨时自动创建
64854f6 fix: 修复 LLM 流式请求错误无反馈
a7a5f09 feat: LLM 请求优先使用 Responses API
2f95d04 feat: 扩展 LLM 提供商并支持 Z.AI 思考强度
```
