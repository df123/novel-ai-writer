# Token Usage Tracking 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 DeepSeek 流式响应中捕获 token usage 数据，持久化到数据库并在前端展示

**Architecture:** 服务器端仅在请求体中添加 stream_options 参数，继续透传 SSE；前端在流式解析时从最后一个 chunk 提取 usage，保存到消息中；UI 在消息底部和聊天顶部展示用量

**Tech Stack:** TypeScript, Vue 3 Composition API, Element Plus, SQLite (sql.js), SSE

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/shared/types.ts` | 新增 TokenUsage 类型，扩展 Message/DbMessage |
| 修改 | `src/server/db/schema.ts` | 数据库迁移，新增 token_usage 列 |
| 修改 | `src/server/utils/formatters.ts` | token_usage 字段序列化/反序列化 |
| 修改 | `src/server/services/llmService.ts` | 请求体添加 stream_options |
| 修改 | `src/server/routes/messages.ts` | 消息 CRUD 支持 token_usage |
| 修改 | `src/renderer/utils/api.ts` | messageApi 支持 tokenUsage 参数 |
| 修改 | `src/renderer/stores/chatStore.ts` | StreamChunk 扩展、usage 解析、保存 |
| 修改 | `src/renderer/components/ChatPanel.vue` | UI 展示 token 用量 |

---

## Task 1: 共享类型定义

**文件**: `src/shared/types.ts`
**行号范围**: 第 11-58 行（ToolCall/Message 附近），第 355-367 行（DbMessage）

### Step 1.1: 新增 TokenUsage 接口

在 `ToolCall` 接口（第 19 行 `}`）之后、`Message` 接口注释之前插入 `TokenUsage` 接口：

```typescript
/**
 * LLM API 返回的 token 用量（统一接口）
 */
export interface TokenUsage {
  /** 输入 token 数 */
  promptTokens: number;
  /** 输出 token 数 */
  completionTokens: number;
  /** 总 token 数 */
  totalTokens: number;
  /** 缓存命中 token（DeepSeek 专有） */
  promptCacheHitTokens?: number;
  /** 缓存未命中 token（DeepSeek 专有） */
  promptCacheMissTokens?: number;
  /** 思考 token 数 */
  reasoningTokens?: number;
}
```

**插入位置**: 在第 19 行（`ToolCall` 接口闭合的 `}`）之后，第 21 行（`/** 聊天消息接口`）之前。

### Step 1.2: 在 Message 接口添加 tokenUsage 字段

在 `Message` 接口中，`orderIndex` 字段（第 57 行）之后添加：

```typescript
  /** 该消息的 token 用量（仅助手角色，可选） */
  tokenUsage?: TokenUsage;
```

**修改后 Message 接口尾部**（第 55-59 行变为）:
```typescript
  /** 消息在聊天中的顺序索引 */
  orderIndex: number;

  /** 该消息的 token 用量（仅助手角色，可选） */
  tokenUsage?: TokenUsage;
}
```

### Step 1.3: 在 DbMessage 接口添加 token_usage 字段

在 `DbMessage` 接口中，`deleted_at` 字段（第 367 行）之后添加：

```typescript
  /** token 用量 JSON 字符串 */
  token_usage: string | null;
```

**修改后 DbMessage 接口尾部**（第 364-368 行变为）:
```typescript
  order_index: number;
  deleted: number;
  deleted_at: number | null;
  /** token 用量 JSON 字符串 */
  token_usage: string | null;
}
```

### 预期结果
- `TokenUsage` 接口被所有模块共享
- `Message` 接口可选包含 `tokenUsage`
- `DbMessage` 接口可选包含 `token_usage`（JSON 字符串）
- TypeScript 编译无错误

### Commit 建议
```
feat(types): 添加 TokenUsage 类型和 Message/DbMessage 扩展
```

---

## Task 2: 数据库迁移

**文件**: `src/server/db/schema.ts`
**行号范围**: 第 71-83 行（`getMigrationSQLs` 函数）

### Step 2.1: 添加 token_usage 列迁移语句

在 `getMigrationSQLs()` 返回的数组中（第 82 行 `ALTER TABLE timeline_nodes...` 之后）添加一条新的迁移语句：

```typescript
'ALTER TABLE timeline_nodes ADD COLUMN deleted_at INTEGER DEFAULT NULL',
'ALTER TABLE messages ADD COLUMN token_usage TEXT DEFAULT NULL'
```

**修改后 `getMigrationSQLs` 函数完整代码**:
```typescript
export function getMigrationSQLs(): string[] {
  return [
    'ALTER TABLE messages ADD COLUMN tool_calls TEXT',
    'ALTER TABLE messages ADD COLUMN tool_call_id TEXT',
    'ALTER TABLE characters ADD COLUMN relationships TEXT',
    'ALTER TABLE character_versions ADD COLUMN relationships TEXT',
    'ALTER TABLE timeline_nodes ADD COLUMN date TEXT',
    'ALTER TABLE timeline_versions ADD COLUMN date TEXT',
    'ALTER TABLE characters ADD COLUMN deleted INTEGER DEFAULT 0',
    'ALTER TABLE characters ADD COLUMN deleted_at INTEGER DEFAULT NULL',
    'ALTER TABLE timeline_nodes ADD COLUMN deleted INTEGER DEFAULT 0',
    'ALTER TABLE timeline_nodes ADD COLUMN deleted_at INTEGER DEFAULT NULL',
    'ALTER TABLE messages ADD COLUMN token_usage TEXT DEFAULT NULL'
  ];
}
```

### 预期结果
- 现有数据库启动时自动添加 `token_usage` 列（TEXT, DEFAULT NULL）
- 新数据库创建时 messages 表也包含该列
- 已有数据不受影响（NULL 值）
- 启动服务器后检查数据库，确认 `messages` 表有 `token_usage` 列

### Commit 建议
```
feat(db): 添加 messages.token_usage 列迁移
```

---

## Task 3: 服务器端格式化（序列化/反序列化）

**文件**: `src/server/utils/formatters.ts`
**行号范围**: 第 81-101 行（`formatMessage` 函数）

### Step 3.1: 更新 formatMessage 函数处理 token_usage

在 `formatMessage` 函数中，处理 `token_usage` JSON 字符串 → `TokenUsage` 对象的转换。

**需要做的变更**:
1. 在导入中添加 `TokenUsage` 类型
2. 在 `formatMessage` 函数中添加 `tokenUsage` 处理逻辑

**导入修改**（第 2-28 行），在导入列表末尾添加 `TokenUsage`:

当前第 2-28 行：
```typescript
import type {
  DbProject,
  Project,
  DbChat,
  Chat,
  DbMessage,
  Message,
  DbTimelineNode,
  TimelineNode,
  DbTimelineVersion,
  TimelineNodeVersion,
  DbCharacter,
  Character,
  DbCharacterVersion,
  CharacterVersion,
  DbChapter,
  Chapter,
  DbTheme,
  Theme,
  DbThemeHistory,
  ThemeHistory,
  DbMiscRecord,
  MiscRecord,
  DbMiscRecordVersion,
  MiscRecordVersion,
  ToolCall
} from '@shared/types';
```

修改为：
```typescript
import type {
  DbProject,
  Project,
  DbChat,
  Chat,
  DbMessage,
  Message,
  DbTimelineNode,
  TimelineNode,
  DbTimelineVersion,
  TimelineNodeVersion,
  DbCharacter,
  Character,
  DbCharacterVersion,
  CharacterVersion,
  DbChapter,
  Chapter,
  DbTheme,
  Theme,
  DbThemeHistory,
  ThemeHistory,
  DbMiscRecord,
  MiscRecord,
  DbMiscRecordVersion,
  MiscRecordVersion,
  ToolCall,
  TokenUsage
} from '@shared/types';
```

**formatMessage 函数修改**（当前第 81-101 行），添加 tokenUsage 处理：

当前代码：
```typescript
export function formatMessage(message: DbMessage): Message {
  const formatted: Message = {
    id: message.id,
    chatId: message.chat_id,
    role: message.role as 'system' | 'user' | 'assistant' | 'tool',
    content: message.content,
    reasoning_content: message.reasoning_content ?? undefined,
    tool_call_id: message.tool_call_id ?? undefined,
    timestamp: message.timestamp,
    orderIndex: message.order_index,
    deleted: message.deleted === 1,
    deletedAt: message.deleted_at ?? undefined,
    tool_calls: undefined
  };

  if (message.tool_calls) {
    formatted.tool_calls = parseToolCalls(message.tool_calls) ?? undefined;
  }

  return formatted;
}
```

修改为：
```typescript
export function formatMessage(message: DbMessage): Message {
  const formatted: Message = {
    id: message.id,
    chatId: message.chat_id,
    role: message.role as 'system' | 'user' | 'assistant' | 'tool',
    content: message.content,
    reasoning_content: message.reasoning_content ?? undefined,
    tool_call_id: message.tool_call_id ?? undefined,
    timestamp: message.timestamp,
    orderIndex: message.order_index,
    deleted: message.deleted === 1,
    deletedAt: message.deleted_at ?? undefined,
    tool_calls: undefined,
    tokenUsage: undefined
  };

  if (message.tool_calls) {
    formatted.tool_calls = parseToolCalls(message.tool_calls) ?? undefined;
  }

  if (message.token_usage) {
    try {
      formatted.tokenUsage = JSON.parse(message.token_usage) as TokenUsage;
    } catch (e) {
      console.error('Failed to parse token_usage:', e);
    }
  }

  return formatted;
}
```

### Step 3.2: 添加 prepareTokenUsageForDb 辅助函数

在 `formatMessage` 函数之后（约第 115 行），添加一个辅助函数用于将 `TokenUsage` 对象序列化为数据库字符串：

```typescript
/**
 * 将 TokenUsage 对象序列化为数据库存储格式
 * @param tokenUsage - TokenUsage 对象
 * @returns JSON 字符串，输入为 undefined 时返回 null
 */
export function serializeTokenUsage(tokenUsage: TokenUsage | undefined): string | null {
  if (!tokenUsage) return null;
  return JSON.stringify(tokenUsage);
}
```

### 预期结果
- `formatMessage` 能正确解析 `token_usage` JSON → `tokenUsage` 对象
- `serializeTokenUsage` 能将 `TokenUsage` → JSON 字符串
- 无 token_usage 的历史消息 `tokenUsage` 为 `undefined`（优雅降级）

### Commit 建议
```
feat(formatters): 添加 token_usage 序列化/反序列化支持
```

---

## Task 4: 服务器端请求参数（stream_options）

**文件**: `src/server/services/llmService.ts`
**行号范围**: 第 117-136 行（requestBody 构建）

### Step 4.1: 在请求体中添加 stream_options

在 `requestBody` 对象构建后（第 136 行之后），添加 `stream_options` 参数。

当前代码（第 117-136 行）：
```typescript
  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages: cleanedMessages,
    stream: true,
    temperature: options.temperature,
    top_p: options.topP,
    max_tokens: options.maxTokens
  };

  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }

  if (options.thinking && provider === 'deepseek') {
    requestBody.thinking = options.thinking;
  }

  if (options.reasoning_effort && provider === 'deepseek') {
    requestBody.reasoning_effort = options.reasoning_effort;
  }
```

修改为：
```typescript
  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages: cleanedMessages,
    stream: true,
    temperature: options.temperature,
    top_p: options.topP,
    max_tokens: options.maxTokens
  };

  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }

  if (options.thinking && provider === 'deepseek') {
    requestBody.thinking = options.thinking;
  }

  if (options.reasoning_effort && provider === 'deepseek') {
    requestBody.reasoning_effort = options.reasoning_effort;
  }

  // DeepSeek 支持 stream_options 以在流式响应中返回 usage
  if (provider === 'deepseek') {
    requestBody.stream_options = { include_usage: true };
  }
```

### 预期结果
- DeepSeek 请求体包含 `stream_options: { include_usage: true }`
- OpenRouter 请求体不包含此参数（避免不兼容）
- SSE 流中最后一个 chunk 将包含 `usage` 字段
- 服务器端仍然是纯透传，不解析 usage

### Commit 建议
```
feat(llm): 为 DeepSeek 请求添加 stream_options 以获取 usage
```

---

## Task 5: 服务器端消息 CRUD 支持 token_usage

**文件**: `src/server/routes/messages.ts`
**行号范围**: 第 14-31 行（请求体接口），第 59-84 行（创建），第 89-119 行（更新）

### Step 5.1: 更新 CreateMessageRequestBody 接口

在第 14-20 行的 `CreateMessageRequestBody` 接口中添加 `tokenUsage` 字段：

当前代码：
```typescript
interface CreateMessageRequestBody {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
```

修改为：
```typescript
interface CreateMessageRequestBody {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  tokenUsage?: import('@shared/types').TokenUsage;
}
```

### Step 5.2: 更新 UpdateMessageRequestBody 接口

在第 25-31 行的 `UpdateMessageRequestBody` 接口中添加 `tokenUsage` 字段：

当前代码：
```typescript
interface UpdateMessageRequestBody {
  role?: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
```

修改为：
```typescript
interface UpdateMessageRequestBody {
  role?: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  tokenUsage?: import('@shared/types').TokenUsage;
}
```

### Step 5.3: 添加 serializeTokenUsage 导入

在第 6 行导入中添加 `serializeTokenUsage`：

当前代码：
```typescript
import { parseToolCalls } from '../utils/formatters';
```

修改为：
```typescript
import { parseToolCalls, serializeTokenUsage } from '../utils/formatters';
```

### Step 5.4: 更新创建消息路由（INSERT 语句）

当前第 59-84 行创建消息路由：

```typescript
router.post('/chats/:chatId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { role, content, reasoning_content, tool_calls, tool_call_id } = req.body as CreateMessageRequestBody;
  
  const id = generateId();
  const timestamp = now();
  const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;

  run(
    'INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls, tool_call_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, chatId, role, content, reasoning_content ?? null, toolCallsJson, tool_call_id || null, timestamp]
  );

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [timestamp, chatId]);

  saveDB();

  const messages = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  const message = messages[0];
  const messageWithParsedCalls = {
    ...message,
    tool_calls: parseToolCalls(message.tool_calls)
  };
  
  res.status(201).json(messageWithParsedCalls);
}));
```

修改为：
```typescript
router.post('/chats/:chatId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { role, content, reasoning_content, tool_calls, tool_call_id, tokenUsage } = req.body as CreateMessageRequestBody;
  
  const id = generateId();
  const timestamp = now();
  const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;
  const tokenUsageJson = serializeTokenUsage(tokenUsage);

  run(
    'INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls, tool_call_id, timestamp, token_usage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, chatId, role, content, reasoning_content ?? null, toolCallsJson, tool_call_id || null, timestamp, tokenUsageJson]
  );

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [timestamp, chatId]);

  saveDB();

  const messages = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  const message = messages[0];
  const messageWithParsedCalls = {
    ...message,
    tool_calls: parseToolCalls(message.tool_calls),
    token_usage: message.token_usage,
  };
  
  res.status(201).json(messageWithParsedCalls);
}));
```

### Step 5.5: 更新获取消息路由（返回 token_usage）

当前第 43-54 行获取消息路由已经在做 `...msg` 展开，所以 `token_usage` 字段会被自动包含。但需要确保返回时也解析 `token_usage`。

当前代码：
```typescript
router.get('/chats/:chatId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const messages = query<DbMessage>('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chatId]);
  
  const messagesWithParsedCalls = messages.map((msg: DbMessage) => ({
    ...msg,
    tool_calls: parseToolCalls(msg.tool_calls),
    reasoning_content: msg.reasoning_content,
  }));
  
  res.json(messagesWithParsedCalls);
}));
```

修改为：
```typescript
router.get('/chats/:chatId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const messages = query<DbMessage>('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chatId]);
  
  const messagesWithParsedCalls = messages.map((msg: DbMessage) => ({
    ...msg,
    tool_calls: parseToolCalls(msg.tool_calls),
    reasoning_content: msg.reasoning_content,
    token_usage: msg.token_usage,
  }));
  
  res.json(messagesWithParsedCalls);
}));
```

> 注意：`token_usage` 已经是 JSON 字符串，前端需要负责解析。或者我们可以直接在这里返回解析后的对象。但为了与 `tool_calls` 模式保持一致（数据库中是字符串，返回时也是字符串），这里保持原样返回字符串。前端 `chatStore.loadMessages` 将负责最终解析。

实际上，更合理的做法是在 GET 路由中直接返回解析后的 JSON（因为前端 `loadMessages` 直接 `response.data` 映射）。但查看 `loadMessages` 的代码（chatStore.ts 第 83-90 行），它直接使用 `...m` 展开，所以只要后端返回的字段名正确即可。

最终决定：GET 路由返回时将 `token_usage` 字符串保持原样（与 tool_calls 的 parseToolCalls 模式一致），前端会在 `loadMessages` 中处理。

### Step 5.6: 更新更新消息路由（UPDATE 语句）

当前第 89-119 行更新消息路由：

```typescript
router.put('/messages/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, content, reasoning_content, tool_calls, tool_call_id } = req.body as UpdateMessageRequestBody;

  const existing = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  if (existing.length === 0) {
    res.status(404).json({ error: '消息未找到' });
    return;
  }

  const existingMessage = existing[0];
  const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;
  
  run(
    'UPDATE messages SET role = ?, content = ?, reasoning_content = ?, tool_calls = ?, tool_call_id = ? WHERE id = ?',
    [role, content, reasoning_content ?? null, toolCallsJson, tool_call_id || null, id]
  );

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), existingMessage.chat_id]);

  saveDB();

  const messages = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  const message = messages[0];
  const messageWithParsedCalls = {
    ...message,
    tool_calls: parseToolCalls(message.tool_calls)
  };
  
  res.json(messageWithParsedCalls);
}));
```

修改为：
```typescript
router.put('/messages/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, content, reasoning_content, tool_calls, tool_call_id, tokenUsage } = req.body as UpdateMessageRequestBody;

  const existing = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  if (existing.length === 0) {
    res.status(404).json({ error: '消息未找到' });
    return;
  }

  const existingMessage = existing[0];
  const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;
  const tokenUsageJson = serializeTokenUsage(tokenUsage);
  
  run(
    'UPDATE messages SET role = ?, content = ?, reasoning_content = ?, tool_calls = ?, tool_call_id = ?, token_usage = ? WHERE id = ?',
    [role, content, reasoning_content ?? null, toolCallsJson, tool_call_id || null, tokenUsageJson, id]
  );

  run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), existingMessage.chat_id]);

  saveDB();

  const messages = query<DbMessage>('SELECT * FROM messages WHERE id = ?', [id]);
  const message = messages[0];
  const messageWithParsedCalls = {
    ...message,
    tool_calls: parseToolCalls(message.tool_calls),
    token_usage: message.token_usage,
  };
  
  res.json(messageWithParsedCalls);
}));
```

### 预期结果
- POST `/chats/:chatId/messages` 接受 `tokenUsage` 字段，序列化为 `token_usage` 存入数据库
- PUT `/messages/:id` 接受 `tokenUsage` 字段，更新 `token_usage` 列
- GET `/chats/:chatId/messages` 返回 `token_usage` 字段
- 无 tokenUsage 的请求照常工作（token_usage 为 null）

### Commit 建议
```
feat(messages): 消息 CRUD 支持 token_usage 字段
```

---

## Task 6: 前端 API 层更新

**文件**: `src/renderer/utils/api.ts`
**行号范围**: 第 33-39 行（messageApi）

### Step 6.1: 更新 messageApi 类型定义

当前第 33-39 行：
```typescript
export const messageApi = {
  list: (chatId: string) => api.get(`/chats/${chatId}/messages`),
  create: (chatId: string, data: { role: string; content: string; reasoning_content?: string; tool_calls?: any[]; tool_call_id?: string }) => api.post(`/chats/${chatId}/messages`, data),
  update: (id: string, data: { role: string; content: string; reasoning_content?: string; tool_calls?: any[]; tool_call_id?: string }) => api.put(`/messages/${id}`, data),
  delete: (id: string) => api.delete(`/messages/${id}`),
  batchDelete: (ids: string[]) => api.post('/messages/batch-delete', { ids }),
};
```

修改为：
```typescript
export const messageApi = {
  list: (chatId: string) => api.get(`/chats/${chatId}/messages`),
  create: (chatId: string, data: { role: string; content: string; reasoning_content?: string; tool_calls?: any[]; tool_call_id?: string; tokenUsage?: any }) => api.post(`/chats/${chatId}/messages`, data),
  update: (id: string, data: { role: string; content: string; reasoning_content?: string; tool_calls?: any[]; tool_call_id?: string; tokenUsage?: any }) => api.put(`/messages/${id}`, data),
  delete: (id: string) => api.delete(`/messages/${id}`),
  batchDelete: (ids: string[]) => api.post('/messages/batch-delete', { ids }),
};
```

### 预期结果
- `messageApi.create` 和 `messageApi.update` 接受 `tokenUsage` 参数
- 编译无类型错误

### Commit 建议
```
feat(api): messageApi 支持 tokenUsage 参数
```

---

## Task 7: 前端流式解析和保存

**文件**: `src/renderer/stores/chatStore.ts`
**行号范围**: 第 1-4 行（导入），第 32-41 行（StreamChunk），第 83-90 行（loadMessages），第 840-1039 行（runLLMTurn）

### Step 7.1: 更新导入

当前第 3 行：
```typescript
import { Message, Chat, TimelineNode, Character, Chapter } from '../../shared/types';
```

修改为：
```typescript
import { Message, Chat, TimelineNode, Character, Chapter, TokenUsage } from '../../shared/types';
```

### Step 7.2: 扩展 StreamChunk 接口

当前第 32-41 行：
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
}
```

修改为：
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
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  } | null;
}
```

### Step 7.3: 更新 loadMessages 解析 token_usage

当前第 83-90 行：
```typescript
  const loadMessages = async (chatId: string) => {
    const response = await messageApi.list(chatId);
    messages.value = response.data.map((m: any, i: number) => ({
      ...m,
      orderIndex: i + 1,
      reasoning_content: m.reasoning_content ?? undefined,
    }));
    updateTokenCount();
  };
```

修改为：
```typescript
  const loadMessages = async (chatId: string) => {
    const response = await messageApi.list(chatId);
    messages.value = response.data.map((m: any, i: number) => ({
      ...m,
      orderIndex: i + 1,
      reasoning_content: m.reasoning_content ?? undefined,
      tokenUsage: m.token_usage ? (typeof m.token_usage === 'string' ? JSON.parse(m.token_usage) : m.token_usage) : undefined,
    }));
    updateTokenCount();
  };
```

> 注意：后端 GET 路由返回的 `token_usage` 可能是 JSON 字符串（直接来自数据库），也可能已经被展开。为安全起见，做类型判断。

### Step 7.4: 在 runLLMTurn 中添加 usage 提取

在 `runLLMTurn` 函数内部（约第 865 行区域），添加 `tokenUsage` 变量声明和解析逻辑。

**Step 7.4a**: 在 `buffer` 变量声明之后（当前第 868 行），添加 tokenUsage 声明：

当前代码（第 865-868 行）：
```typescript
      let fullContent = '';
      let fullReasoning = '';
      const accumulatedToolCalls: Record<number, ToolCall> = {};
      let buffer = '';
```

修改为：
```typescript
      let fullContent = '';
      let fullReasoning = '';
      const accumulatedToolCalls: Record<number, ToolCall> = {};
      let buffer = '';
      let tokenUsage: TokenUsage | null = null;
```

**Step 7.4b**: 在 SSE 解析循环中提取 usage。在 `if (delta?.tool_calls)` 代码块之后（当前第 936 行 `}` 之后），`catch` 之前，添加 usage 提取：

当前代码（第 936-939 行）：
```typescript
                }
              }
            } catch (e) {
              console.error('Failed to parse stream chunk:', e, data);
```

修改为：
```typescript
                }
              }
              // 提取 token usage（在最后一个包含 usage 的 chunk 中）
              if (parsed.usage) {
                tokenUsage = {
                  promptTokens: parsed.usage.prompt_tokens,
                  completionTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                  promptCacheHitTokens: parsed.usage.prompt_cache_hit_tokens,
                  promptCacheMissTokens: parsed.usage.prompt_cache_miss_tokens,
                  reasoningTokens: parsed.usage.completion_tokens_details?.reasoning_tokens,
                };
              }
            } catch (e) {
              console.error('Failed to parse stream chunk:', e, data);
```

**Step 7.4c**: 在流式完成后（消息更新时）附加 tokenUsage。在第 964-971 行更新消息的代码中添加 `tokenUsage`：

当前代码（第 964-972 行）：
```typescript
          messages.value = messages.value.map((m, i) => 
            i === msgIndex ? { 
              ...m, 
              content: finalContent,
              reasoning_content: finalReasoning,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            } : m
          );
```

修改为：
```typescript
          messages.value = messages.value.map((m, i) => 
            i === msgIndex ? { 
              ...m, 
              content: finalContent,
              reasoning_content: finalReasoning,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              tokenUsage: tokenUsage ?? undefined,
            } : m
          );
```

**Step 7.4d**: 在保存消息时包含 tokenUsage。在第 975-980 行 `messageApi.create` 调用中添加 `tokenUsage`：

当前代码（第 975-980 行）：
```typescript
          const assistantResponse = await messageApi.create(currentChat.value.id, {
            role: 'assistant',
            content: finalContent,
            reasoning_content: finalReasoning,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          });
```

修改为：
```typescript
          const assistantResponse = await messageApi.create(currentChat.value.id, {
            role: 'assistant',
            content: finalContent,
            reasoning_content: finalReasoning,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            tokenUsage: tokenUsage ?? undefined,
          });
```

### 预期结果
- SSE 流中最后一个 chunk 的 `usage` 被正确提取为 `TokenUsage` 对象
- assistant 消息在本地状态和数据库中都包含 `tokenUsage`
- 历史消息加载时 `token_usage` 被正确解析为 `tokenUsage`
- 无 usage 数据时（历史消息/其他提供商）`tokenUsage` 为 `undefined`
- `loadMessages` 从后端返回的 `token_usage` 字段正确解析

### Commit 建议
```
feat(chatStore): 流式解析 token usage 并持久化到消息
```

---

## Task 8: 前端 UI 展示

**文件**: `src/renderer/components/ChatPanel.vue`
**行号范围**: 第 20-22 行（header token 标签），第 66-68 行（消息 token 标签），第 127-133 行（assistant 消息底部），第 290-301 行（导入），第 319 行（storeToRefs），第 1400+ 行（样式）

### Step 8.1: 更新 header 中的 token 标签（累计用量）

将 header 中现有的估算 token 标签（第 20-22 行）替换为累计 token 用量显示：

当前代码（第 20-22 行）：
```html
        <el-tag size="small" type="info">
          {{ totalTokens }} tokens
        </el-tag>
```

修改为：
```html
        <el-tag v-if="accumulatedTokenUsage.totalTokens > 0" size="small" type="info">
          累计: {{ formatTokenCount(accumulatedTokenUsage.totalTokens) }} tokens
        </el-tag>
        <el-tag v-else size="small" type="info">
          ~{{ totalTokens }} tokens
        </el-tag>
```

### Step 8.2: 在 assistant 消息底部添加 token 用量标签

在 assistant 消息的回答区域之后（第 133 行 `</div>` 之后，`</el-card>` 第 134 行之前），添加 token 用量展示：

当前代码（第 127-134 行）：
```html
            <div v-if="message.role === 'assistant' && displayContent(message)">
              <div class="answer-box">
                <div class="answer-title">✍️ 回答</div>
                <div v-if="isStreaming && message.role === 'assistant' && index === messages.length - 1" class="markdown-content" v-html="renderMarkdown(displayContent(message))"></div>
                <div v-else class="markdown-content" v-html="renderMarkdown(displayContent(message))"></div>
              </div>
            </div>
          </el-card>
```

修改为：
```html
            <div v-if="message.role === 'assistant' && displayContent(message)">
              <div class="answer-box">
                <div class="answer-title">✍️ 回答</div>
                <div v-if="isStreaming && message.role === 'assistant' && index === messages.length - 1" class="markdown-content" v-html="renderMarkdown(displayContent(message))"></div>
                <div v-else class="markdown-content" v-html="renderMarkdown(displayContent(message))"></div>
              </div>
            </div>
            <!-- Token 用量展示 -->
            <div v-if="message.role === 'assistant' && message.tokenUsage" class="token-usage-bar">
              <span class="token-usage-item">输入: {{ formatTokenCount(message.tokenUsage.promptTokens) }}</span>
              <span class="token-usage-separator">|</span>
              <span class="token-usage-item">输出: {{ formatTokenCount(message.tokenUsage.completionTokens) }}</span>
              <span class="token-usage-separator">|</span>
              <span class="token-usage-item">总计: {{ formatTokenCount(message.tokenUsage.totalTokens) }}</span>
              <template v-if="message.tokenUsage.promptCacheHitTokens !== undefined">
                <span class="token-usage-separator">|</span>
                <span class="token-usage-item">缓存命中: {{ formatTokenCount(message.tokenUsage.promptCacheHitTokens) }}</span>
              </template>
              <template v-if="message.tokenUsage.promptCacheMissTokens !== undefined">
                <span class="token-usage-separator">|</span>
                <span class="token-usage-item">缓存未命中: {{ formatTokenCount(message.tokenUsage.promptCacheMissTokens) }}</span>
              </template>
              <template v-if="message.tokenUsage.reasoningTokens !== undefined && message.tokenUsage.reasoningTokens > 0">
                <span class="token-usage-separator">|</span>
                <span class="token-usage-item">思考: {{ formatTokenCount(message.tokenUsage.reasoningTokens) }}</span>
              </template>
            </div>
          </el-card>
```

### Step 8.3: 更新 script setup 导入

在第 290 行的导入中添加 `TokenUsage`：

当前代码（第 290 行）：
```typescript
import type { Message } from '../../shared/types';
```

修改为：
```typescript
import type { Message, TokenUsage } from '../../shared/types';
```

### Step 8.4: 添加 computed 和辅助函数

在第 319 行 `storeToRefs` 解构之后，添加累计 token 用量的 computed 和格式化函数：

当前代码（第 319 行）：
```typescript
const { chats, currentChat, messages, isLoading, isStreaming, currentStreamContent, currentStreamReasoning, totalTokens } = storeToRefs(chatStore);
```

在此行之后（约第 327 行 `const { createChat, sendMessage, cancelMessage, deleteMessage } = chatStore;` 之后），添加：

```typescript
/** 累计 token 用量（基于有实际 tokenUsage 数据的 assistant 消息） */
const accumulatedTokenUsage = computed(() => {
  const result = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  for (const msg of messages.value) {
    if (msg.role === 'assistant' && msg.tokenUsage) {
      result.promptTokens += msg.tokenUsage.promptTokens;
      result.completionTokens += msg.tokenUsage.completionTokens;
      result.totalTokens += msg.tokenUsage.totalTokens;
    }
  }
  return result;
});

/** 格式化 token 数量显示 */
const formatTokenCount = (count: number): string => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return String(count);
};
```

### Step 8.5: 添加样式

在 `</style>` 闭合标签之前（约第 1593 行），添加 token 用量相关样式：

```css
/* Token 用量展示样式 */
.token-usage-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
  font-size: 11px;
  color: #909399;
}

.token-usage-item {
  white-space: nowrap;
}

.token-usage-separator {
  margin: 0 4px;
  color: #dcdfe6;
}
```

### 预期结果
- 聊天顶部 header 显示累计 token 用量（如有实际数据）或估算值（如无）
- 每个 assistant 消息底部显示该消息的 token 用量（如有数据）
- DeepSeek 消息额外显示缓存命中和思考 token
- 无 tokenUsage 的历史消息不显示 token 用量标签（优雅降级）
- token 数量超过 1000 时自动格式化为 "1.2k" 格式

### Commit 建议
```
feat(ui): 展示 token 用量（消息底部 + 聊天顶部累计）
```

---

## 完整实现顺序总结

| 步骤 | 文件 | 依赖 |
|------|------|------|
| Task 1 | `src/shared/types.ts` | 无 |
| Task 2 | `src/server/db/schema.ts` | Task 1 |
| Task 3 | `src/server/utils/formatters.ts` | Task 1 |
| Task 4 | `src/server/services/llmService.ts` | 无 |
| Task 5 | `src/server/routes/messages.ts` | Task 3 |
| Task 6 | `src/renderer/utils/api.ts` | 无 |
| Task 7 | `src/renderer/stores/chatStore.ts` | Task 1, Task 6 |
| Task 8 | `src/renderer/components/ChatPanel.vue` | Task 7 |

**Task 1-4 可并行执行**（无交叉依赖）。Task 5 依赖 Task 3，Task 7 依赖 Task 1 + Task 6，Task 8 依赖 Task 7。

## 验证清单

- [ ] `pnpm typecheck` 无错误
- [ ] `pnpm lint` 无新增错误
- [ ] 启动 `pnpm dev` 服务器正常启动
- [ ] 向 DeepSeek 发送消息，检查最后一条 SSE chunk 是否包含 `usage` 字段
- [ ] 检查 assistant 消息底部是否显示 token 用量标签
- [ ] 检查聊天顶部是否显示累计 token 用量
- [ ] 刷新页面后历史消息的 tokenUsage 数据仍然存在
- [ ] 无 tokenUsage 的历史消息不显示 token 用量标签（优雅降级）
- [ ] OpenRouter 提供商不受影响（无 stream_options 参数）
