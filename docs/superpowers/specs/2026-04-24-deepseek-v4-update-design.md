# DeepSeek V4 模型更新设计

## 背景

DeepSeek API 发布了新一代模型，旧模型将于 2026/07/24 弃用：
- **新模型**：`deepseek-v4-flash`、`deepseek-v4-pro`
- **弃用模型**：`deepseek-chat`、`deepseek-reasoner`
- **新参数**：`reasoning_effort`（可选值：`high`、`medium`、`low`）

## 决策

| 决策项 | 结论 |
|--------|------|
| 旧模型处理 | 直接移除 deepseek-chat 和 deepseek-reasoner |
| 新模型 | deepseek-v4-flash + deepseek-v4-pro |
| 默认模型 | 改为 deepseek-v4-flash |
| reasoning_effort | 两个新模型都支持，前端用下拉选择（high/medium/low/不设置） |
| thinking 参数 | 所有 DeepSeek 模型都启用，保持现有行为 |

## 修改文件清单

### 1. 后端配置 — `src/server/config/index.ts`

- 替换模型列表：
  - `deepseek-v4-flash` → "DeepSeek V4 Flash"
  - `deepseek-v4-pro` → "DeepSeek V4 Pro"
- API 端点 URL 保持不变

### 2. 后端服务 — `src/server/services/llmService.ts`

- `chatStream()` 中：当 options 包含 `reasoning_effort` 时，将其加入请求体
- 默认模型 fallback 从 `deepseek-reasoner` 改为 `deepseek-v4-flash`

### 3. 前端设置 Store — `src/renderer/stores/settingsStore.ts`

- 新增 `reasoningEffort` 状态（`ref<string>('high')`），可选值 `high`/`medium`/`low`/空字符串
- 默认模型从 `deepseek-reasoner` 改为 `deepseek-v4-flash`

### 4. 前端聊天 Store — `src/renderer/stores/chatStore.ts`

- 发送请求时，将 `reasoningEffort` 传入 options（仅 DeepSeek 提供商时传值）

### 5. 前端 API 层 — `src/renderer/utils/api.ts`

- `llmApi.chat` 的 options 类型增加 `reasoning_effort?: string`

### 6. 前端组件 — `src/renderer/components/ChatPanel.vue`

- 在模型选择器附近添加 `reasoning_effort` 下拉选择（仅当 provider 为 deepseek 时显示）
- 选项：高（high）、中（medium）、低（low）、默认（不传参）

## API 调用示例

更新后的请求体结构：
```json
{
  "model": "deepseek-v4-pro",
  "messages": [...],
  "stream": true,
  "thinking": {"type": "enabled"},
  "reasoning_effort": "high"
}
```

## 影响范围

- 不影响 OpenRouter 提供商的任何功能
- 不影响数据库 schema（reasoning_content 字段保持不变）
- 不影响 Function Calling（tools 参数保持不变）
- 已存储的历史消息中旧模型名不受影响（仅作为文本记录）
