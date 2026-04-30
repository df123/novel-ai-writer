# 斜杠命令系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NovelAI Writer 添加斜杠命令系统，支持用户通过 `/` 命令快速触发 LLM 功能，所有命令遵循"先问后做"原则。

**Architecture:** 前端实现命令解析和 UI 交互（下拉菜单、高亮显示），System Prompt 添加命令识别逻辑，LLM 通过提示词识别并处理命令。前端不做命令处理，仅提供 UI 效果。

**Tech Stack:** Vue 3, TypeScript, Element Plus, Pinia

## 文件结构

### 新增文件
- `src/renderer/utils/commands.ts` - 命令定义、解析逻辑、拼写错误匹配算法

### 修改文件
- `src/renderer/utils/prompts.ts` - 在 System Prompt 中添加斜杠命令系统说明
- `src/renderer/components/ChatPanel.vue` - 添加命令下拉菜单、高亮显示、输入过滤

### 测试文件
- 无专门测试文件，通过手动测试验证

## 任务分解

### Task 1: 创建命令定义和解析逻辑

**Files:**
- Create: `src/renderer/utils/commands.ts`

- [ ] **Step 1: 创建命令接口和命令列表**

```typescript
// 命令定义
interface Command {
  name: string;        // 命令名（不含/）
  label: string;       // 显示标签
  description: string; // 描述
  group: string;       // 分组
}

// 命令列表
const commands: Command[] = [
  // 📝 讨论与交互
  { name: 'ask', label: '/ask', description: '提问澄清', group: '讨论与交互' },
  { name: 'discuss', label: '/discuss', description: '讨论话题', group: '讨论与交互' },
  { name: 'brainstorm', label: '/brainstorm', description: '头脑风暴', group: '讨论与交互' },
  // ✍️ 内容生成
  { name: 'next', label: '/next', description: '编写下一章', group: '内容生成' },
  { name: 'outline', label: '/outline', description: '生成大纲', group: '内容生成' },
  // 🔧 工具与数据更新
  { name: 'timeline', label: '/timeline', description: '更新时间线', group: '工具与数据更新' },
  { name: 'character', label: '/character', description: '更新人物', group: '工具与数据更新' },
  { name: 'theme', label: '/theme', description: '更新主旨', group: '工具与数据更新' },
  { name: 'misc', label: '/misc', description: '更新杂项', group: '工具与数据更新' },
  { name: 'update', label: '/update', description: '批量更新全部', group: '工具与数据更新' },
  // 🔍 审查
  { name: 'review', label: '/review', description: '审查内容', group: '审查' },
];
```

- [ ] **Step 2: 添加命令解析函数**

```typescript
// 解析输入中的命令
function parseCommands(input: string): string[] {
  const matches = input.match(/\/\w+/g);
  return matches || [];
}

// 检查是否是有效命令
function isValidCommand(cmd: string): boolean {
  return commands.some(c => '/' + c.name === cmd);
}

// 检查输入中是否包含有效命令
function hasCommands(input: string): boolean {
  const matches = input.match(/\/\w+/g);
  if (!matches) return false;
  return matches.some(cmd => isValidCommand(cmd));
}
```

- [ ] **Step 3: 添加拼写错误匹配算法**

```typescript
// 拼写错误匹配算法（Levenshtein 距离）
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 删除
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// 查找最接近的命令建议
function findClosestCommand(input: string): Command | null {
  const inputCmd = input.startsWith('/') ? input : '/' + input;
  let minDistance = Infinity;
  let closest: Command | null = null;
  
  for (const cmd of commands) {
    const distance = levenshteinDistance(inputCmd, cmd.label);
    // 距离小于 3 且比当前最小距离小
    if (distance < 3 && distance < minDistance) {
      minDistance = distance;
      closest = cmd;
    }
  }
  
  return closest;
}
```

- [ ] **Step 4: 添加命令选择函数**

```typescript
// 选择命令（点击下拉菜单项时调用）
function selectCommand(cmd: Command, inputText: Ref<string>, inputRef: Ref<HTMLInputElement | null>, showCommandMenu: Ref<boolean>): void {
  // 将命令文本插入到输入框
  // 如果已有文本，替换已输入的命令部分
  // 如果是新输入，直接插入命令
  const commandText = cmd.label + ' '; // 带空格，方便输入参数
  
  // 获取当前光标位置
  const cursorPos = inputRef.value?.selectionStart || 0;
  const beforeCursor = inputText.value.substring(0, cursorPos);
  const afterCursor = inputText.value.substring(cursorPos);
  
  // 找到最后一个 / 的位置（命令起始点）
  const lastSlashIndex = beforeCursor.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    // 替换已输入的命令部分
    inputText.value = beforeCursor.substring(0, lastSlashIndex) + commandText + afterCursor;
  } else {
    // 直接插入命令
    inputText.value = beforeCursor + commandText + afterCursor;
  }
  
  // 关闭下拉菜单
  showCommandMenu.value = false;
  
  // 聚焦输入框
  nextTick(() => {
    inputRef.value?.focus();
  });
}
```

- [ ] **Step 5: 导出所有函数和类型**

```typescript
export type { Command };
export { commands, parseCommands, isValidCommand, hasCommands, levenshteinDistance, findClosestCommand, selectCommand };
```

- [ ] **Step 6: 验证文件创建**

运行: `ls -la src/renderer/utils/commands.ts`
预期: 文件存在且包含正确的 TypeScript 代码

- [ ] **Step 7: 提交命令解析模块**

```bash
git add src/renderer/utils/commands.ts
git commit -m "feat: add slash command parsing and definition module"
```

### Task 2: 更新 System Prompt

**Files:**
- Modify: `src/renderer/utils/prompts.ts:17-46`

- [ ] **Step 1: 在 buildSystemPrompt 函数中添加斜杠命令系统提示**

在 `prompts.ts` 文件的 `buildSystemPrompt` 函数中，在现有工具提示之后添加以下内容：

```typescript
// 在 if (tools && tools.length > 0) 块之后添加
systemPrompt += `\n\n## 斜杠命令系统

用户可能使用以下斜杠命令，你必须识别并遵循相应行为：

### 核心原则
**先问后做**：收到任何命令后，先询问具体需求、细节、偏好，用户确认后再执行。不要突然开始生成内容。

### 命令列表

#### 📝 讨论与交互
- \`/ask\` - 针对当前内容提问澄清，帮助用户理清思路
- \`/discuss\` - 讨论当前话题，先问用户想讨论什么方面
- \`/brainstorm\` - 头脑风暴，先问用户想 brainstorm 什么主题

#### ✍️ 内容生成
- \`/next\` - 编写下一章，先问：章节标题、主要情节、字数要求、风格偏好
- \`/outline\` - 生成大纲，先问：故事范围、重点角色、大纲详细程度

#### 🔧 工具与数据更新
- \`/timeline\` - 更新时间线，先问：要添加/修改哪些事件、时间范围
- \`/character\` - 更新人物，先问：人物名称、需要更新的信息
- \`/theme\` - 更新主旨，先问：主旨内容、与现有主旨的关系
- \`/misc\` - 更新杂项，先问：记录类型、内容详情
- \`/update\` - 批量更新全部，依次询问：时间线、人物、主旨、杂项的更新内容

#### 🔍 审查
- \`/review\` - 审查内容，先问：审查重点、关注方面

### 组合命令
用户可能组合使用命令（如 \`/timeline /next\`），按顺序处理每个命令，每个命令都要先询问再执行。`;
```

- [ ] **Step 2: 验证 System Prompt 更新**

运行: `grep -n "斜杠命令系统" src/renderer/utils/prompts.ts`
预期: 找到添加的斜杠命令系统提示

- [ ] **Step 3: 提交 System Prompt 更新**

```bash
git add src/renderer/utils/prompts.ts
git commit -m "feat: add slash command system to system prompt"
```

### Task 3: 修改 ChatPanel.vue 添加命令下拉菜单

**Files:**
- Modify: `src/renderer/components/ChatPanel.vue:196-230`

- [ ] **Step 1: 添加命令相关导入**

在 `ChatPanel.vue` 的 `<script setup>` 部分添加导入：

```typescript
import { commands, parseCommands, isValidCommand, hasCommands, findClosestCommand, selectCommand } from '../utils/commands';
import type { Command } from '../utils/commands';
```

- [ ] **Step 2: 添加命令菜单状态变量**

在 `ChatPanel.vue` 的 `<script setup>` 部分添加状态变量：

```typescript
// 命令菜单相关
const showCommandMenu = ref(false);
const commandFilter = ref('');
const selectedCommandIndex = ref(0);
```

- [ ] **Step 3: 添加命令分组计算属性**

在 `ChatPanel.vue` 的 `<script setup>` 部分添加计算属性：

```typescript
// 命令分组
const groupedCommands = computed(() => {
  const groups: { name: string; icon: string; commands: Command[] }[] = [
    { name: '讨论与交互', icon: '📝', commands: [] },
    { name: '内容生成', icon: '✍️', commands: [] },
    { name: '工具与数据更新', icon: '🔧', commands: [] },
    { name: '审查', icon: '🔍', commands: [] },
  ];
  
  const filteredCommands = commandFilter.value
    ? commands.filter(cmd => 
        cmd.name.includes(commandFilter.value) || 
        cmd.description.includes(commandFilter.value)
      )
    : commands;
  
  filteredCommands.forEach(cmd => {
    const group = groups.find(g => g.name === cmd.group);
    if (group) {
      group.commands.push(cmd);
    }
  });
  
  return groups.filter(g => g.commands.length > 0);
});
```

- [ ] **Step 4: 添加输入事件处理函数**

在 `ChatPanel.vue` 的 `<script setup>` 部分添加输入处理函数：

```typescript
// 处理输入事件，检测命令
const handleInput = () => {
  const text = inputText.value;
  const cursorPos = inputRef.value?.selectionStart || 0;
  const beforeCursor = text.substring(0, cursorPos);
  
  // 检测是否输入了 /
  const lastSlashIndex = beforeCursor.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    const afterSlash = beforeCursor.substring(lastSlashIndex + 1);
    // 如果没有空格，说明正在输入命令
    if (!afterSlash.includes(' ')) {
      commandFilter.value = afterSlash;
      showCommandMenu.value = true;
      selectedCommandIndex.value = 0;
      return;
    }
  }
  
  // 检查是否包含有效命令（用于高亮显示）
  if (hasCommands(text)) {
    // 包含有效命令，可以添加高亮样式
  }
  
  showCommandMenu.value = false;
  commandFilter.value = '';
};
```

- [ ] **Step 5: 添加键盘事件处理函数**

在 `ChatPanel.vue` 的 `<script setup>` 部分添加键盘处理函数：

```typescript
// 处理键盘事件
const handleCommandKeydown = (event: KeyboardEvent) => {
  if (!showCommandMenu.value) return;
  
  const flatCommands = groupedCommands.value.flatMap(g => g.commands);
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedCommandIndex.value = (selectedCommandIndex.value + 1) % flatCommands.length;
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedCommandIndex.value = (selectedCommandIndex.value - 1 + flatCommands.length) % flatCommands.length;
      break;
    case 'Enter':
      event.preventDefault();
      if (flatCommands[selectedCommandIndex.value]) {
        selectCommand(flatCommands[selectedCommandIndex.value], inputText, inputRef, showCommandMenu);
      }
      break;
    case 'Escape':
      event.preventDefault();
      showCommandMenu.value = false;
      break;
  }
};
```

- [ ] **Step 6: 添加输入框引用**

在 `ChatPanel.vue` 的 `<script setup>` 部分添加输入框引用：

```typescript
const inputRef = ref<HTMLInputElement | null>(null);
```

- [ ] **Step 7: 修改输入框模板**

在 `ChatPanel.vue` 的模板部分，修改输入框区域：

```vue
<el-footer class="chat-footer">
  <div class="input-wrapper">
    <!-- 命令下拉菜单 -->
    <div v-if="showCommandMenu" class="command-menu">
      <div v-for="group in groupedCommands" :key="group.name" class="command-group">
        <div class="group-label">{{ group.icon }} {{ group.name }}</div>
        <div 
          v-for="(cmd, index) in group.commands" 
          :key="cmd.name"
          :class="['command-item', { 'command-item-active': selectedCommandIndex === index }]"
          @click="selectCommand(cmd, inputText, inputRef, showCommandMenu)"
        >
          <span class="command-name">{{ cmd.label }}</span>
          <span class="command-desc">{{ cmd.description }}</span>
        </div>
      </div>
    </div>
    
    <el-input
      v-model="inputText"
      type="textarea"
      :rows="3"
      placeholder="输入您的问题或写作需求... (输入 / 触发命令)"
      :disabled="isLoading || !currentChat"
      @keydown.enter="handleKeyDown"
      @input="handleInput"
      @keydown="handleCommandKeydown"
      class="chat-input"
      ref="inputRef"
    />
    <div class="input-actions">
      <!-- 取消按钮 -->
      <el-button
        v-if="isLoading"
        :icon="Close"
        type="danger"
        @click="handleCancel"
        class="cancel-button"
      >
        取消
      </el-button>
      <!-- 发送按钮 -->
      <el-button
        v-else
        :icon="Promotion"
        type="primary"
        @click="handleSend"
        :disabled="!inputText.trim() || !currentChat"
      >
        发送
      </el-button>
    </div>
  </div>
</el-footer>
```

- [ ] **Step 8: 添加命令菜单样式**

在 `ChatPanel.vue` 的 `<style scoped>` 部分添加样式：

```css
/* 命令菜单样式 */
.command-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  margin-bottom: 8px;
}

.command-group {
  padding: 8px 0;
}

.command-group:not(:last-child) {
  border-bottom: 1px solid #f0f0f0;
}

.group-label {
  padding: 8px 16px;
  font-size: 12px;
  color: #909399;
  font-weight: 600;
}

.command-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.command-item:hover,
.command-item-active {
  background-color: #f5f7fa;
}

.command-name {
  font-weight: 600;
  color: #409eff;
  margin-right: 12px;
  min-width: 100px;
}

.command-desc {
  color: #666;
  font-size: 13px;
}

/* 命令高亮样式 */
.command-highlight {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
}
```

- [ ] **Step 9: 验证下拉菜单功能**

运行: `pnpm dev` 启动开发服务器
在浏览器中打开应用，输入 `/` 验证下拉菜单是否显示

- [ ] **Step 10: 提交下拉菜单功能**

```bash
git add src/renderer/components/ChatPanel.vue
git commit -m "feat: add slash command dropdown menu to ChatPanel"
```

### Task 4: 添加命令高亮显示

**Files:**
- Modify: `src/renderer/components/ChatPanel.vue:90-92`

- [ ] **Step 1: 修改用户消息显示部分**

在 `ChatPanel.vue` 的模板部分，修改用户消息显示：

```vue
<div v-if="message.role === 'user'" class="user-message">
  <span v-if="hasCommands(message.content)" class="command-text">{{ message.content }}</span>
  <span v-else>{{ message.content }}</span>
</div>
```

- [ ] **Step 2: 添加命令文本样式**

在 `ChatPanel.vue` 的 `<style scoped>` 部分添加样式：

```css
/* 命令文本高亮样式 */
.command-text {
  color: #409eff;
  font-weight: 500;
  background-color: #ecf5ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}
```

- [ ] **Step 3: 验证高亮显示**

运行: `pnpm dev` 启动开发服务器
发送包含命令的消息（如 `/timeline`），验证命令文本是否高亮显示

- [ ] **Step 4: 提交高亮显示功能**

```bash
git add src/renderer/components/ChatPanel.vue
git commit -m "feat: add command text highlighting in chat messages"
```

### Task 5: 测试和验证

**Files:**
- 无新增文件，仅测试现有功能

- [ ] **Step 1: 测试基本命令输入**

1. 启动开发服务器：`pnpm dev`
2. 在聊天输入框中输入 `/`
3. 验证下拉菜单是否显示所有命令
4. 输入 `/ask`，验证菜单是否过滤显示
5. 选择命令，验证是否自动补全

- [ ] **Step 2: 测试命令组合**

1. 输入 `/timeline /next`
2. 验证两个命令是否都被识别
3. 发送消息，验证 LLM 是否按顺序处理

- [ ] **Step 3: 测试拼写错误建议**

1. 输入 `/timline`（拼写错误）
2. 验证是否显示 `/timeline` 建议
3. 点击建议，验证是否自动修正

- [ ] **Step 4: 测试边界情况**

1. 输入 `/`（空命令）
2. 输入 `/invalid`（无效命令）
3. 输入 `请帮我 /timeline 更新时间线`（命令在文本中间）
4. 验证各种情况的处理是否正确

- [ ] **Step 5: 测试 System Prompt**

1. 发送 `/ask` 命令
2. 验证 LLM 是否先询问用户想问什么
3. 发送 `/update` 命令
4. 验证 LLM 是否依次询问时间线、人物、主旨、杂项的更新内容

- [ ] **Step 6: 提交最终版本**

```bash
git add .
git commit -m "feat: complete slash command system implementation"
```

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-04-28-slash-commands-implementation.md`。

**两种执行方式：**

**1. Subagent-Driven（推荐）** - 我为每个任务分发一个新的子代理，任务之间进行审查，快速迭代

**2. Inline Execution** - 在当前会话中使用 executing-plans 执行任务，批量执行并设置检查点

**选择哪种方式？**