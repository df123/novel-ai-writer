# 斜杠命令系统设计文档

## 概述

为 NovelAI Writer 添加斜杠命令系统，支持用户通过 `/` 命令快速触发 LLM 功能。所有命令遵循"先问后做"原则，LLM 收到命令后先询问细节，再执行操作。

## 命令分组

### 📝 讨论与交互
| 命令 | 用途 |
|------|------|
| `/ask` | 让 LLM 针对当前内容提问澄清 |
| `/discuss` | 讨论当前话题，LLM 先问细节再深入 |
| `/brainstorm` | 头脑风暴新想法 |

### ✍️ 内容生成
| 命令 | 用途 |
|------|------|
| `/next` | 编写下一章（LLM 先问要求） |
| `/outline` | 生成/更新大纲 |

### 🔧 工具与数据更新
| 命令 | 用途 |
|------|------|
| `/timeline` | 添加/更新时间线 |
| `/character` | 添加/更新人物 |
| `/theme` | 添加/更新主旨 |
| `/misc` | 添加/更新杂项记录 |
| `/update` | 批量更新全部（时间线+人物+主旨+杂项） |

### 🔍 审查
| 命令 | 用途 |
|------|------|
| `/review` | 审查当前内容，提出改进建议 |

## 核心行为规则

**先问后做**：收到任何命令后，先询问具体需求、细节、偏好，用户确认后再执行。不要突然开始生成内容。

**组合命令**：支持空格分隔的组合命令，按顺序处理每个命令。每个命令在组合中都有独立的询问阶段，包括 `/ask`。

**组合命令处理规则**：
- 每个命令独立执行"先问后做"流程
- 前一个命令完成后，才开始处理下一个命令
- `/ask` 在组合中也遵循相同规则：先询问用户想问什么，得到回答后再继续下一个命令

示例：
- `/ask /next` → 先问用户想问什么，回答后，再问下一章的要求，最后写
- `/timeline /next` → 先问时间线细节，更新后，再问下一章要求
- `/update` → 批量更新全部内容（依次询问时间线、人物、主旨、杂项）
- `/update /next` → 更新全部后，再问下一章要求

## UI 交互设计

### 触发方式

**输入 `/` 时**：
- 弹出下拉菜单，显示所有可用命令
- 命令按分组显示（讨论、生成、工具、审查）
- 支持键盘上下箭头选择，回车确认

**输入命令后**：
- 命令文本高亮显示（如蓝色）
- 表示已识别为有效命令

### 下拉菜单样式

```
┌─────────────────────────────┐
│ 📝 讨论与交互               │
│   /ask      提问澄清        │
│   /discuss  讨论话题        │
│   /brainstorm 头脑风暴      │
├─────────────────────────────┤
│ ✍️ 内容生成                 │
│   /next     编写下一章      │
│   /outline  生成大纲        │
├─────────────────────────────┤
│ 🔧 工具与数据更新           │
│   /timeline 更新时间线      │
│   /character 更新人物       │
│   /theme    更新主旨        │
│   /misc     更新杂项        │
│   /update   批量更新全部    │
├─────────────────────────────┤
│ 🔍 审查                    │
│   /review   审查内容        │
└─────────────────────────────┘
```

### 输入框行为

- 输入 `/` 后继续输入字符，菜单实时过滤
- 例如输入 `/ti` 只显示 `/timeline`
- 选中命令后自动补全为 `/timeline `（带空格，方便输入参数）

### 命令参数支持

**参数格式**：命令支持可选参数，参数以空格分隔，直接跟在命令后面。

**参数示例**：
- `/timeline 2024年1月` → 更新时间线，指定时间范围
- `/character 张三` → 更新人物，指定人物名称
- `/next 第三章` → 编写下一章，指定章节标题

**参数解析方式**：
- 前端不解析参数内容，仅识别命令名
- 参数作为命令文本的一部分，原样发送给 LLM
- LLM 根据上下文理解参数含义

**无参数情况**：
- 命令后无参数时，LLM 会主动询问所需信息
- 例如 `/timeline` → LLM 问"您想更新哪个时间范围的事件？"

## System Prompt 设计

在现有 system prompt 中添加以下内容：

```
## 斜杠命令系统

用户可能使用以下斜杠命令，你必须识别并遵循相应行为：

### 核心原则
**先问后做**：收到任何命令后，先询问具体需求、细节、偏好，用户确认后再执行。不要突然开始生成内容。

### 命令列表

#### 📝 讨论与交互
- `/ask` - 针对当前内容提问澄清，帮助用户理清思路
- `/discuss` - 讨论当前话题，先问用户想讨论什么方面
- `/brainstorm` - 头脑风暴，先问用户想 brainstorm 什么主题

#### ✍️ 内容生成
- `/next` - 编写下一章，先问：章节标题、主要情节、字数要求、风格偏好
- `/outline` - 生成大纲，先问：故事范围、重点角色、大纲详细程度

#### 🔧 工具与数据更新
- `/timeline` - 更新时间线，先问：要添加/修改哪些事件、时间范围
- `/character` - 更新人物，先问：人物名称、需要更新的信息
- `/theme` - 更新主旨，先问：主旨内容、与现有主旨的关系
- `/misc` - 更新杂项，先问：记录类型、内容详情
- `/update` - 批量更新全部，依次询问：时间线、人物、主旨、杂项的更新内容

#### 🔍 审查
- `/review` - 审查内容，先问：审查重点、关注方面

### 组合命令
用户可能组合使用命令（如 `/timeline /next`），按顺序处理每个命令，每个命令都要先询问再执行。
```

## 前端实现细节

### 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `ChatPanel.vue` | 添加命令解析、下拉菜单、高亮显示 |
| `chatStore.ts` | 当前阶段无需修改，后续可能需要扩展以支持消息标记或统计功能 |

### 命令解析逻辑

新增文件：`src/renderer/utils/commands.ts`

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

// 解析输入中的命令
function parseCommands(input: string): string[] {
  const matches = input.match(/\/\w+/g);
  return matches || [];
}

// 检查是否是有效命令
function isValidCommand(cmd: string): boolean {
  return commands.some(c => '/' + c.name === cmd);
}

// 选择命令（点击下拉菜单项时调用）
function selectCommand(cmd: Command): void {
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

// 检查输入中是否包含有效命令
function hasCommands(input: string): boolean {
  const matches = input.match(/\/\w+/g);
  if (!matches) return false;
  return matches.some(cmd => isValidCommand(cmd));
}

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

### 下拉菜单组件

在 `ChatPanel.vue` 的输入框上方添加：

```vue
<!-- 命令下拉菜单 -->
<div v-if="showCommandMenu" class="command-menu">
  <div v-for="group in groupedCommands" :key="group.name" class="command-group">
    <div class="group-label">{{ group.icon }} {{ group.name }}</div>
    <div 
      v-for="cmd in group.commands" 
      :key="cmd.name"
      class="command-item"
      @click="selectCommand(cmd)"
    >
      <span class="command-name">{{ cmd.label }}</span>
      <span class="command-desc">{{ cmd.description }}</span>
    </div>
  </div>
</div>
```

### 高亮显示

在输入框中，如果检测到有效命令，显示高亮样式：

```vue
<!-- 输入框 -->
<div class="input-wrapper">
  <div v-if="hasCommands" class="command-highlight">
    <!-- 高亮的命令文本 -->
  </div>
  <el-input v-model="inputText" @input="onInput" />
</div>
```

## 消息格式与发送流程

### 前端解析的目的

**重要说明**：前端解析命令仅用于 UI 效果（高亮显示、下拉菜单），消息始终以原始文本形式发送给 LLM。前端不做任何命令处理或转换，所有命令逻辑由 LLM 通过 System Prompt 识别和处理。

### 消息发送流程

```
用户输入 "/timeline /next"
        ↓
前端解析命令（检测到 2 个有效命令）
        ↓
显示高亮样式（仅 UI 效果）
        ↓
用户点击发送
        ↓
消息作为普通文本发送给 LLM（原始格式，不做任何转换）
        ↓
LLM 识别命令，按顺序处理：
  1. /timeline → 先问时间线细节，用户确认后执行
  2. /next → 再问下一章要求，用户确认后执行
```

### 消息格式

命令消息与普通消息格式相同，无需特殊标记：

```json
{
  "role": "user",
  "content": "/timeline /next"
}
```

### LLM 响应示例

**用户发送**：`/timeline /next`

**LLM 响应**：
```
好的，我来帮您更新时间线并编写下一章。

首先，关于时间线更新：
1. 您想添加什么事件？
2. 这个事件发生在什么时间？
3. 涉及哪些角色？

请告诉我这些细节，我会先更新时间线，然后再和您讨论下一章的内容。
```

### 命令消息在聊天中的显示

命令消息在用户消息气泡中显示为高亮样式：

```
┌─────────────────────────────┐
│ 👤 用户                     │
│ ┌─────────────────────────┐ │
│ │ /timeline /next         │ │  ← 蓝色高亮
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

## 错误处理与边界情况

### 无效命令处理

**场景**：用户输入 `/invalid`（不存在的命令）

**处理**：
- 前端：下拉菜单不显示匹配项
- 消息：作为普通文本发送给 LLM
- LLM：正常回复，不识别为命令

### 命令拼写错误

**场景**：用户输入 `/timline`（拼写错误）

**处理**：
- 前端：下拉菜单显示最接近的建议（如 `/timeline`）
- 用户可点击建议自动修正

### 空命令

**场景**：用户只输入 `/` 或 `/ `（带空格）

**处理**：
- 前端：显示完整命令菜单
- 不发送消息，等待用户选择或继续输入

### 命令在文本中间

**场景**：用户输入 `请帮我 /timeline 更新时间线`

**处理**：
- 前端：检测到命令，显示高亮
- 消息：作为普通文本发送
- LLM：识别命令并响应

### 重复命令

**场景**：用户输入 `/timeline /timeline`

**处理**：
- 前端：正常显示
- LLM：识别为重复，询问用户意图（是想强调还是误输入）

## 实现优先级

1. **P0 - 核心功能**
   - 命令定义和解析
   - 下拉菜单 UI
   - System Prompt 更新

2. **P1 - 增强功能**
   - 命令高亮显示
   - 输入过滤和自动补全
   - 错误处理和建议

3. **P2 - 优化功能**
   - 命令使用统计
   - 自定义命令支持
   - 命令历史记录
