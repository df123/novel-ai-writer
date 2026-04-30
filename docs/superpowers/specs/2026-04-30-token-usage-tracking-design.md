# Token Usage Tracking 设计文档

> 日期: 2026-04-30
> 状态: 已批准

## 概述

在 DeepSeek 流式响应中捕获 `usage`（token 用量）信息，在前端展示每条消息的单次用量和当前对话的累计用量，同时将数据持久化到数据库。设计统一的 TokenUsage 接口，确保未来可扩展到其他提供商（如 OpenRouter）。

## 背景

### 现状
- `LLMUsage` 类型已在 `src/server/types/service.types.ts` 中定义，但从未在流式处理中使用
- 服务器端 `llmService.chatStream()` 是纯 SSE 透传代理，不提取 `usage` 字段
- 前端 `StreamChunk` 接口没有 `usage` 字段，`runLLMTurn()` 完全忽略 `usage`
- 当前 UI 展示的 token 数是基于字符的粗略估算值（`estimateConversationTokens()`）
- `Message` 和 `DbMessage` 类型中没有 token 相关字段

### DeepSeek API 行为
- 流式响应中，需要设置 `stream_options: { include_usage: true }` 才会在最后一个 chunk 返回 usage
- usage 包含：`prompt_tokens`, `completion_tokens`, `total_tokens`, `prompt_cache_hit_tokens`, `prompt_cache_miss_tokens`
- 还有 `completion_tokens_details.reasoning_tokens`（思考 token 数）

## 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 展示位置 | 消息底部 + 聊天顶部 | 单次用量和累计用量都有价值 |
| 数据持久化 | 持久化到数据库 | 页面刷新后仍可查看历史用量 |
| 可扩展性 | 统一 TokenUsage 接口 | 基础字段所有提供商共有，可选字段提供商特有 |
| 解析位置 | 前端解析 | 最小改动，保持服务器端简洁 |

## 数据模型

### 1. 统一 TokenUsage 类型（`src/shared/types.ts`）

```typescript
/** LLM API 返回的 token 用量（统一接口） */
interface TokenUsage {
  promptTokens: number;           // 输入 token 数
  completionTokens: number;       // 输出 token 数
  totalTokens: number;            // 总 token 数
  promptCacheHitTokens?: number;  // 缓存命中 token（DeepSeek 专有）
  promptCacheMissTokens?: number; // 缓存未命中 token（DeepSeek 专有）
  reasoningTokens?: number;       // 思考 token 数（DeepSeek 专有）
}
```

### 2. Message 类型扩展

```typescript
interface Message {
  // ... 现有字段保持不变 ...
  tokenUsage?: TokenUsage;  // 该 assistant 消息的 token 用量
}
```

### 3. 数据库扩展

`messages` 表新增列：
```sql
ALTER TABLE messages ADD COLUMN token_usage TEXT DEFAULT NULL;
```

`DbMessage` 类型新增：
```typescript
interface DbMessage {
  // ... 现有字段保持不变 ...
  token_usage: string | null;  // JSON.stringify(TokenUsage) | null
}
```

### 4. StreamChunk 类型扩展（`src/renderer/stores/chatStore.ts`）

```typescript
interface StreamChunk {
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: ToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  } | null;
}
```

## 数据流

### 1. 服务器端（`src/server/services/llmService.ts`）

**最小改动**：仅在请求体中添加 `stream_options`：

```typescript
const requestBody = {
  model,
  messages: formattedMessages,
  stream: true,
  stream_options: { include_usage: true },  // 新增
  temperature,
  // ... 其他现有参数
};
```

服务器端保持透传模式，不做额外 usage 提取。

### 2. 前端流式解析（`src/renderer/stores/chatStore.ts` - `runLLMTurn()`）

在现有 SSE 解析循环中增加 usage 提取：

```typescript
let tokenUsage: TokenUsage | null = null;

// 在 for (const line of lines) 循环内：
const parsed = JSON.parse(data) as StreamChunk;

// 提取 usage（在最后一个包含 usage 的 chunk 中）
if (parsed.usage) {
  tokenUsage = {
    promptTokens: parsed.usage.prompt_tokens,
    completionTokens: parsed.usage.completion_tokens,
    totalTokens: parsed.usage.total_tokens,
    promptCacheHitTokens: parsed.usage.prompt_cache_hit_tokens,
    promptCacheMissTokens: parsed.usage.prompt_cache_miss_tokens,
  };
}
```

### 3. 保存到消息

流式完成后，tokenUsage 附加到 assistant 消息并保存到数据库。

### 4. 数据库格式化（`src/server/utils/formatters.ts`）

- `formatMessage()`: `token_usage` JSON 字符串 → `TokenUsage` 对象
- `prepareMessageForDb()`: `TokenUsage` 对象 → `token_usage` JSON 字符串

### 5. 累计用量

聊天顶部通过 computed 属性汇总所有 assistant 消息的 tokenUsage。

## UI 展示

### 1. 消息底部 - 单条消息 Token 用量

- 位置：assistant 消息内容下方
- 格式：`输入: {promptTokens} | 输出: {completionTokens} | 总计: {totalTokens}`
- DeepSeek 额外显示：`缓存命中: {cacheHit} | 缓存未命中: {cacheMiss}`
- 样式：小型、低对比度、不干扰阅读
- 仅在有 tokenUsage 数据的消息上显示

### 2. 聊天顶部 - 累计 Token 用量

- 替换现有的估算值标签
- 格式：`累计: 输入 {sum} | 输出 {sum} | 总计 {sum} tokens`
- 仅统计有实际 tokenUsage 数据的消息
- 对于没有 usage 数据的历史消息，回退到估算

### 3. 流式过程中

usage 在最后一个 chunk 返回，流式完成后立即显示该消息的 token 用量。

## 可扩展性

### 统一接口设计

- `TokenUsage` 基础字段（`promptTokens`, `completionTokens`, `totalTokens`）所有 OpenAI 兼容提供商共有
- 提供商特有字段作为可选属性（如 DeepSeek 的缓存相关字段）
- 未来添加新提供商时，只需确保前端解析 usage 并填入基础字段即可

### 需要修改的文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/shared/types.ts` | 新增 `TokenUsage` 接口，扩展 `Message` 和 `DbMessage` |
| `src/server/services/llmService.ts` | 请求体添加 `stream_options` |
| `src/server/utils/formatters.ts` | 处理 `token_usage` 序列化/反序列化 |
| `src/server/routes/messages.ts` | 消息 CRUD 支持 `token_usage` 字段 |
| `src/renderer/stores/chatStore.ts` | `StreamChunk` 扩展、usage 解析、保存逻辑 |
| `src/renderer/components/ChatPanel.vue` | UI 展示 token 用量 |

## 风险与注意事项

1. **数据库迁移**：新增列需确保对现有数据无影响（DEFAULT NULL）
2. **向后兼容**：历史消息无 tokenUsage 数据，UI 需优雅降级
3. **promptTokens 累计偏高**：每条消息的 prompt 包含之前所有对话，累计展示需标注
4. **stream_options 兼容性**：非 DeepSeek 提供商可能不支持此参数，需按提供商条件添加
