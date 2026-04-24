# DeepSeek V4 模型更新实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 DeepSeek 模型从旧版（deepseek-chat、deepseek-reasoner）迁移到新版（deepseek-v4-flash、deepseek-v4-pro），并新增 reasoning_effort 参数支持。

**Architecture:** 前后端各层同步更新——后端配置模型列表、服务层透传 reasoning_effort 参数；前端新增 reasoningEffort 状态、下拉选择 UI，并在聊天请求中传递该参数。

**Tech Stack:** Vue 3 + Pinia + Element Plus（前端）、Express.js + TypeScript（后端）

---

## 文件修改清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/server/config/index.ts` | 替换 DeepSeek 模型列表 |
| 修改 | `src/server/services/llmService.ts` | 透传 reasoning_effort、更新默认模型 |
| 修改 | `src/renderer/stores/settingsStore.ts` | 新增 reasoningEffort 状态、更新默认模型 |
| 修改 | `src/renderer/stores/chatStore.ts` | 传递 reasoning_effort 到 API 请求 |
| 修改 | `src/renderer/utils/api.ts` | options 类型增加 reasoning_effort |
| 修改 | `src/renderer/components/ChatPanel.vue` | 新增 reasoning_effort 下拉选择 UI |

---

### Task 1: 更新后端配置 — 模型列表

**Files:**
- Modify: `src/server/config/index.ts:51-57`

- [ ] **Step 1: 替换 DeepSeek 模型列表**

将 `src/server/config/index.ts` 第 51-57 行的 deepseek 配置从：

```typescript
  deepseek: {
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }
    ]
  },
```

改为：

```typescript
  deepseek: {
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
    ]
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/server/config/index.ts
git commit -m "feat: update DeepSeek models to v4-flash and v4-pro"
```

---

### Task 2: 更新后端服务 — 透传 reasoning_effort 和默认模型

**Files:**
- Modify: `src/server/services/llmService.ts:29-31` — 接口增加 reasoning_effort
- Modify: `src/server/services/llmService.ts:87` — 更新默认模型
- Modify: `src/server/services/llmService.ts:127-129` — 注入 reasoning_effort 到请求体

- [ ] **Step 1: ChatStreamOptions 接口增加 reasoning_effort 字段**

在 `src/server/services/llmService.ts` 第 30 行（`thinking?: unknown;`）之后，新增一行：

```typescript
  /** 推理努力程度（deepseek 专用，可选值：high/medium/low） */
  reasoning_effort?: string;
```

修改后 ChatStreamOptions 接口为：

```typescript
interface ChatStreamOptions {
  /** API 密钥 */
  apiKey: string;
  
  /** 模型名称 */
  model?: string;
  
  /** 温度参数 */
  temperature?: number;
  
  /** top_p 参数 */
  topP?: number;
  
  /** 最大 token 数 */
  maxTokens?: number;
  
  /** 工具定义数组 */
  tools?: unknown[];
  
  /** 思考参数（deepseek 专用） */
  thinking?: unknown;
  
  /** 推理努力程度（deepseek 专用，可选值：high/medium/low） */
  reasoning_effort?: string;
}
```

- [ ] **Step 2: 更新默认模型**

将第 87 行的：

```typescript
    modelName = options.model || 'deepseek-reasoner';
```

改为：

```typescript
    modelName = options.model || 'deepseek-v4-flash';
```

- [ ] **Step 3: 注入 reasoning_effort 到请求体**

在第 129 行（`if (options.thinking && provider === 'deepseek')` 块之后）新增：

```typescript
  if (options.reasoning_effort && provider === 'deepseek') {
    requestBody.reasoning_effort = options.reasoning_effort;
  }
```

修改后该区域代码为：

```typescript
  if (options.thinking && provider === 'deepseek') {
    requestBody.thinking = options.thinking;
  }

  if (options.reasoning_effort && provider === 'deepseek') {
    requestBody.reasoning_effort = options.reasoning_effort;
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/server/services/llmService.ts
git commit -m "feat: support reasoning_effort param and update default model"
```

---

### Task 3: 更新前端设置 Store — 新增 reasoningEffort 状态

**Files:**
- Modify: `src/renderer/stores/settingsStore.ts:11` — 更新默认模型
- Modify: `src/renderer/stores/settingsStore.ts:16` — 新增 reasoningEffort ref
- Modify: `src/renderer/stores/settingsStore.ts:28` — 加载 reasoningEffort
- Modify: `src/renderer/stores/settingsStore.ts:38` — 更新函数签名
- Modify: `src/renderer/stores/settingsStore.ts:63-65` — 保存 reasoningEffort
- Modify: `src/renderer/stores/settingsStore.ts:78-79` — 同步响应
- Modify: `src/renderer/stores/settingsStore.ts:120-134` — 导出

- [ ] **Step 1: 更新默认模型和新增 reasoningEffort ref**

将第 11 行的：

```typescript
  const selectedModel = ref('deepseek-reasoner');
```

改为：

```typescript
  const selectedModel = ref('deepseek-v4-flash');
```

在第 16 行（`const showToolCalls = ref(false);`）之后新增：

```typescript
  const reasoningEffort = ref('high');
```

- [ ] **Step 2: loadSettings 中加载 reasoningEffort**

在第 29 行（`showThinkingContent.value = ...`）之前新增：

```typescript
      reasoningEffort.value = settings.reasoning_effort || 'high';
```

- [ ] **Step 3: updateSettings 函数签名增加 reasoningEffort**

将第 38 行的 updateSettings 参数类型改为：

```typescript
  const updateSettings = async (settings: { deepseekApiKey?: string; openrouterApiKey?: string; temperature?: number; selectedProvider?: string; selectedModel?: string; showThinkingContent?: boolean; showToolCalls?: boolean; reasoningEffort?: string }) => {
```

- [ ] **Step 4: updateSettings 中保存 reasoningEffort**

在第 65 行（`show_thinking_content` 保存块）之后新增：

```typescript
      if (settings.reasoningEffort !== undefined) {
        currentSettings.reasoning_effort = settings.reasoningEffort;
      }
```

- [ ] **Step 5: updateSettings 响应同步 reasoningEffort**

在第 79 行（`showThinkingContent.value = ...`）之前新增：

```typescript
      reasoningEffort.value = updated.reasoning_effort || 'high';
```

- [ ] **Step 6: 导出 reasoningEffort**

在 return 对象（第 120-134 行）中，`showToolCalls` 之后新增：

```typescript
    reasoningEffort,
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stores/settingsStore.ts
git commit -m "feat: add reasoningEffort state to settings store"
```

---

### Task 4: 更新前端聊天 Store — 传递 reasoning_effort

**Files:**
- Modify: `src/renderer/stores/chatStore.ts:667-678` — llmApi.chat 调用增加 reasoning_effort

- [ ] **Step 1: 在 llmApi.chat 调用中传递 reasoning_effort**

将 `src/renderer/stores/chatStore.ts` 第 667-678 行的 llmApi.chat 调用从：

```typescript
      const response = await llmApi.chat(
        providerName,
        currentMessages,
        {
          model: options.modelName,
          temperature: settingsStore.temperature,
          apiKey,
          tools: ALL_TOOLS,
          thinking: providerName === 'deepseek' ? { type: 'enabled' } : undefined,
        },
        abortController.value?.signal
      );
```

改为：

```typescript
      const response = await llmApi.chat(
        providerName,
        currentMessages,
        {
          model: options.modelName,
          temperature: settingsStore.temperature,
          apiKey,
          tools: ALL_TOOLS,
          thinking: providerName === 'deepseek' ? { type: 'enabled' } : undefined,
          reasoning_effort: providerName === 'deepseek' ? settingsStore.reasoningEffort : undefined,
        },
        abortController.value?.signal
      );
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/chatStore.ts
git commit -m "feat: pass reasoning_effort to LLM chat API"
```

---

### Task 5: 更新前端 API 层 — 类型增加 reasoning_effort

**Files:**
- Modify: `src/renderer/utils/api.ts:108` — options 类型

- [ ] **Step 1: llmApi.chat options 类型增加 reasoning_effort**

将第 108 行的：

```typescript
    options?: { model?: string; temperature?: number; apiKey?: string; tools?: any[]; thinking?: { type: string } },
```

改为：

```typescript
    options?: { model?: string; temperature?: number; apiKey?: string; tools?: any[]; thinking?: { type: string }; reasoning_effort?: string },
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/utils/api.ts
git commit -m "feat: add reasoning_effort to LLM API options type"
```

---

### Task 6: 更新前端组件 — reasoning_effort 下拉选择 UI

**Files:**
- Modify: `src/renderer/components/ChatPanel.vue:10-15` — 模型选择器后新增下拉
- Modify: `src/renderer/components/ChatPanel.vue:271` — 从 settingsStore 解构 reasoningEffort
- Modify: `src/renderer/components/ChatPanel.vue:280` — 更新 currentModel 默认值

- [ ] **Step 1: 从 settingsStore 解构 reasoningEffort**

找到第 271 行附近的 settingsStore 解构：

```typescript
const { selectedProvider, selectedModel, models, isLoadingModels } = storeToRefs(settingsStore);
```

改为：

```typescript
const { selectedProvider, selectedModel, models, isLoadingModels, reasoningEffort } = storeToRefs(settingsStore);
```

- [ ] **Step 2: 更新 currentModel 默认值**

将第 280 行的：

```typescript
const currentModel = computed(() => selectedModel.value || 'deepseek-reasoner');
```

改为：

```typescript
const currentModel = computed(() => selectedModel.value || 'deepseek-v4-flash');
```

- [ ] **Step 3: 在模板中添加 reasoning_effort 下拉选择**

在 `</el-select>` （模型选择器，约第 15 行）之后、token 计数之前，新增：

```html
        <el-select v-if="selectedProvider === 'deepseek'" v-model="reasoningEffort" size="small" class="effort-select" @change="handleReasoningEffortChange">
          <el-option label="高" value="high" />
          <el-option label="中" value="medium" />
          <el-option label="低" value="low" />
        </el-select>
```

- [ ] **Step 4: 添加 handleReasoningEffortChange 函数**

在 script setup 中的 handleModelChange 函数附近，新增：

```typescript
const handleReasoningEffortChange = async (value: string) => {
  try {
    await settingsStore.updateSettings({ reasoningEffort: value });
  } catch (error) {
    console.error('Failed to save reasoning effort:', error);
  }
};
```

- [ ] **Step 5: 添加 effort-select 样式**

在 `<style>` 部分中，`.model-select` 样式附近，新增：

```css
.effort-select {
  width: 80px;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/ChatPanel.vue
git commit -m "feat: add reasoning_effort dropdown to chat panel"
```

---

### Task 7: 更新数据库默认值兼容

**Files:**
- Modify: `src/renderer/stores/settingsStore.ts:28` — 已在 Task 3 处理

此任务无需额外操作。settingsStore 的 `loadSettings` 已通过 `settings.reasoning_effort || 'high'` 兼容旧数据。

- [ ] **Step 1: 验证旧数据兼容**

确认 `settingsStore.ts` 中 `selectedModel` 的加载逻辑（第 28 行）：
```typescript
selectedModel.value = settings.selected_model || 'deepseek-v4-flash';
```
这将确保旧的 `deepseek-reasoner` 设置在新模型列表中找不到时，自动回退到 `deepseek-v4-flash`。同时 `loadModels` 函数（第 103-105 行）已有回退逻辑：
```typescript
if (!selectedModel.value || !models.value.find(m => m.id === selectedModel.value)) {
  selectedModel.value = models.value[0]?.id || '';
}
```
这确保了如果旧设置的模型名不在新列表中，会自动选择第一个可用模型。

---

### Task 8: 验证和测试

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
pnpm typecheck
```

预期：无类型错误

- [ ] **Step 2: 运行 ESLint 检查**

```bash
pnpm lint
```

预期：无 lint 错误

- [ ] **Step 3: 启动开发服务器验证**

```bash
pnpm dev
```

验证以下功能：
1. 模型选择器显示 DeepSeek V4 Flash 和 DeepSeek V4 Pro
2. reasoning_effort 下拉选择在 DeepSeek 提供商下显示
3. 切换到 OpenRouter 时 reasoning_effort 下拉隐藏
4. 发送消息能正常工作

- [ ] **Step 4: Final commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve any issues found during testing"
```
