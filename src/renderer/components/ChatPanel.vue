<template>
  <el-main v-if="currentProject" class="chat-main">
    <el-header class="chat-header">
      <span class="panel-title">写作区</span>
      <div class="header-controls">
        <el-select v-model="selectedProvider" size="small" class="provider-select" @change="handleProviderChange">
          <el-option label="DeepSeek" value="deepseek" />
          <el-option label="OpenRouter" value="openrouter" />
        </el-select>
        <el-select v-model="selectedModel" size="small" class="model-select" filterable :loading="isLoadingModels" @change="handleModelChange" placeholder="选择模型">
          <el-option v-for="model in models" :key="model.id" :label="model.name" :value="model.id">
            <span>{{ model.name }}</span>
            <span v-if="model.price" class="model-price">{{ model.price }}</span>
          </el-option>
        </el-select>
        <el-select v-if="selectedProvider === 'deepseek'" v-model="reasoningEffort" size="small" class="effort-select" @change="handleReasoningEffortChange">
          <el-option label="高" value="high" />
          <el-option label="最大" value="max" />
        </el-select>
        <el-tag v-if="accumulatedTokenUsage.totalTokens > 0" size="small" type="info">
          累计: {{ formatTokenCount(accumulatedTokenUsage.totalTokens) }} tokens
        </el-tag>
        <el-tag v-else size="small" type="info">
          ~{{ totalTokens }} tokens
        </el-tag>
      </div>
    </el-header>

    <div v-if="!currentChat" class="empty-chat">
      <div class="empty-chat-content">
        <p class="empty-text">暂无对话记录</p>
        <el-button type="primary" @click="handleCreateChat">创建新对话</el-button>
      </div>
    </div>

    <div v-else class="messages-container">
      <!-- 消息内容包裹容器 -->
      <div class="messages-content-wrapper">
        <!-- 消息列表 -->
        <div class="messages-list" ref="messagesListRef" @scroll="handleScroll">
          <div
            v-for="(message, index) in messages"
            :key="message.id + index"
            :id="'msg-' + message.id"
            class="message-item"
          >
          <div class="message-header">
            <span class="message-role">
              Role: {{ message.role }}
            </span>
            <el-tag
              :type="message.role === 'user' ? 'primary' : 'info'"
              size="small"
            >
              {{ message.role === 'user' ? '作者' : 'AI助手' }}
            </el-tag>
            <!-- 流式传输状态指示器 -->
            <div v-if="isStreaming && message.role === 'assistant' && index === messages.length - 1" class="streaming-indicator">
              <span class="streaming-dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
              <span class="streaming-text">正在生成回复</span>
            </div>
            <span class="message-time">
              {{ formatTimestamp(message.timestamp) }}
            </span>
            <span class="message-tokens">
              ~{{ estimateMessageTokens(message) }} tokens
            </span>
            <el-dropdown
              trigger="click"
              class="message-dropdown"
              @command="(cmd: string) => handleMessageCommand(cmd, message)"
            >
              <el-button :icon="MoreFilled" circle size="small" text />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="message.role === 'assistant'" command="saveChapter">保存为章节</el-dropdown-item>
                  <el-dropdown-item command="delete">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <el-card
            :body-style="{
              padding: '12px',
              backgroundColor: message.role === 'user' ? '#e3f2fd' : '#f5f5f5'
            }"
            shadow="never"
          >
            <div v-if="message.role === 'user'" class="user-message" v-html="highlightCommands(message.content)">
            </div>
            <div v-if="message.role === 'tool'">
              <div class="tool-result">
                <div class="tool-result-title">📋 工具结果</div>
                <pre class="tool-result-content">{{ formatToolArguments(message.content) }}</pre>
              </div>
            </div>
            <div v-if="message.role === 'assistant' && displayReasoning(message)">
              <div class="reasoning-box">
                <div class="reasoning-header">
                  <span>💭 思考过程</span>
                  <el-button link size="small" class="collapse-btn" @click="toggleCollapse('reasoning-' + message.id)">
                    <span class="collapse-text">{{ collapsedReasoning[message.id] ? '展开' : '收起' }}</span>
                  </el-button>
                </div>
                <div v-if="!collapsedReasoning[message.id]" class="markdown-content reasoning-content" v-html="renderMarkdown(displayReasoning(message))"></div>
              </div>
            </div>

            <div v-if="message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0">
              <div class="tool-calls-section">
                <div class="tool-calls-header">
                  <span>🔧 工具调用 ({{ message.tool_calls.length }})</span>
                  <el-button link size="small" class="collapse-btn" @click="toggleCollapse('tools-' + message.id)">
                    <span class="collapse-text">{{ collapsedTools[message.id] ? '展开' : '收起' }}</span>
                  </el-button>
                </div>
                <div v-if="!collapsedTools[message.id]">
                  <div v-for="(toolCall, i) in message.tool_calls" :key="i" class="tool-call-item">
                    <div class="tool-call-name">{{ toolCall.function.name }}</div>
                    <pre class="tool-call-arguments">{{ formatToolArguments(toolCall.function.arguments) }}</pre>
                  </div>
                </div>
              </div>
            </div>

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
        </div>
        
        <!-- 加载指示器 -->
        <div v-if="isLoading && !isStreaming" class="loading-indicator">
          <el-icon class="is-loading" :size="20">
            <Loading />
          </el-icon>
          <span class="loading-text">AI 正在思考...</span>
        </div>
        
        <div ref="messagesEndRef"></div>

        <!-- 回到底部按钮 -->
        <transition name="fade">
          <div
            v-if="showScrollToBottom"
            class="scroll-to-bottom-btn"
            @click="onScrollToBottomClick"
          >
            <el-icon :size="20"><ArrowDown /></el-icon>
          </div>
        </transition>
      </div>

      <!-- 消息导航面板 -->
      <div class="message-nav-panel" :class="{ 'nav-panel-collapsed': !isNavPanelVisible }">
        <div class="nav-panel-header">
          <span class="nav-panel-title">对话索引</span>
          <el-button
            :icon="isNavPanelVisible ? DArrowRight : DArrowLeft"
            circle
            size="small"
            @click="isNavPanelVisible = !isNavPanelVisible"
            class="nav-panel-toggle-btn"
            title="折叠/展开索引面板"
          />
        </div>
        <div v-if="isNavPanelVisible" class="nav-panel-list">
          <div
            v-for="msg in userMessages"
            :key="msg.id"
            :class="['nav-item', { 'nav-item-active': activeMessageId === msg.id }]"
            @click="scrollToMessage(msg.id)"
          >
            <div class="nav-item-header">
              <span class="nav-item-round">#{{ msg.roundIndex }}</span>
              <span class="nav-item-time">{{ formatTimestamp(msg.timestamp) }}</span>
            </div>
            <div class="nav-item-content">
              {{ msg.content.length > 40 ? msg.content.slice(0, 40) + '...' : msg.content }}
            </div>
          </div>
          <div v-if="userMessages.length === 0" class="nav-empty">
            暂无用户消息
          </div>
        </div>
      </div>
    </div>
  </div>

    <el-footer class="chat-footer">
      <div class="input-wrapper">
        <!-- 命令下拉菜单 -->
        <transition name="command-menu-fade">
          <div v-if="showCommandMenu && filteredCommands.length > 0" class="command-menu">
            <div class="command-menu-header">
              <span class="command-menu-title">可用命令</span>
              <span class="command-menu-hint">↑↓ 导航 · Enter 选择 · Esc 关闭</span>
            </div>
            <div class="command-menu-list">
              <template v-for="[group, commands] in groupedCommands" :key="group">
                <div class="command-group-header">
                  {{ COMMAND_GROUP_LABELS[group] }}
                </div>
                <div
                  v-for="cmd in commands"
                  :key="cmd.name"
                  :class="['command-item', { 'command-item-active': filteredCommands[selectedCommandIndex]?.name === cmd.name }]"
                  @click="selectCommand(cmd)"
                  @mouseenter="selectedCommandIndex = filteredCommands.findIndex(c => c.name === cmd.name)"
                >
                  <div class="command-item-main">
                    <span class="command-name">/{{ cmd.name }}</span>
                    <span class="command-label">{{ cmd.label }}</span>
                  </div>
                  <div class="command-description">{{ cmd.description }}</div>
                </div>
              </template>
            </div>
          </div>
        </transition>
        
        <el-input
          ref="inputRef"
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入您的问题或写作需求... (输入 / 查看可用命令)"
          :disabled="isLoading || !currentChat"
          @keydown.enter="handleKeyDown"
          @input="handleInput"
          @focus="handleFocus"
          class="chat-input"
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

    <el-dialog
      v-model="saveChapterDialogVisible"
      title="保存为章节"
      width="500px"
    >
      <el-form label-width="80px">
        <el-form-item label="章节编号">
          <el-input-number v-model="saveChapterNumber" :min="1" />
        </el-form-item>
        <el-form-item label="章节标题">
          <el-input v-model="saveChapterTitle" placeholder="请输入章节标题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveChapterDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!saveChapterTitle.trim()" @click="handleSaveChapter">
          保存
        </el-button>
      </template>
    </el-dialog>
  </el-main>
  <el-empty v-else description="请先选择或创建一个项目" class="empty-project" />
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import type { Message, TokenUsage } from '../../shared/types';
import { storeToRefs } from 'pinia';
import { Promotion, MoreFilled, Close, Loading, DArrowLeft, DArrowRight, ArrowDown } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useChatStore } from '../stores/chatStore';
import { useProjectStore } from '../stores/projectStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useCharacterStore } from '../stores/characterStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useChapterStore } from '../stores/chapterStore';
import { useThemeStore } from '../stores/themeStore';
import { formatTimestamp, estimateMessageTokens } from '../../shared/utils';
import { marked } from 'marked';
import { COMMANDS, COMMAND_GROUP_LABELS, CommandGroup, type Command } from '../utils/commands';
import type { InputInstance } from 'element-plus';

marked.setOptions({
  breaks: true,
  gfm: true
});

const chatStore = useChatStore();
const projectStore = useProjectStore();
const timelineStore = useTimelineStore();
const characterStore = useCharacterStore();
const settingsStore = useSettingsStore();
const chapterStore = useChapterStore();
const themeStore = useThemeStore();

const { chats, currentChat, messages, isLoading, isStreaming, currentStreamContent, currentStreamReasoning, totalTokens } = storeToRefs(chatStore);
const { currentProject } = storeToRefs(projectStore);
const { nodes: timelineNodes, selectedNode } = storeToRefs(timelineStore);
const { characters } = storeToRefs(characterStore);
const { selectedProvider, selectedModel, models, isLoadingModels, reasoningEffort } = storeToRefs(settingsStore);
const { theme: currentTheme } = storeToRefs(themeStore);
const { loadModels, updateSettings } = settingsStore;

const { createChat, sendMessage, cancelMessage, deleteMessage } = chatStore;

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

const currentModel = computed(() => selectedModel.value || 'deepseek-v4-flash');

const inputText = ref('');
const messagesEndRef = ref<HTMLElement | null>(null);
const collapsedReasoning = ref<Record<string, boolean>>({});
const collapsedTools = ref<Record<string, boolean>>({});
const saveChapterDialogVisible = ref(false);
const saveChapterMessage = ref<Message | null>(null);
const saveChapterTitle = ref('');
const saveChapterNumber = ref(1);

// 导航面板相关
const isNavPanelVisible = ref(true);
const activeMessageId = ref<string | null>(null);

// 命令菜单相关
const showCommandMenu = ref(false);
const commandFilter = ref('');
const selectedCommandIndex = ref(0);
const inputRef = ref<InputInstance | null>(null);

// 按分组过滤后的命令列表
const groupedCommands = computed(() => {
  const filter = commandFilter.value.toLowerCase();
  const grouped = new Map<CommandGroup, Command[]>();
  
  for (const group of Object.values(CommandGroup)) {
    const commands = COMMANDS.filter(cmd => {
      if (cmd.group !== group) return false;
      if (!filter) return true;
      // 支持名称、标签、描述和别名过滤
      return cmd.name.includes(filter) || 
             cmd.label.includes(filter) || 
             cmd.description.includes(filter) ||
             cmd.aliases?.some(alias => alias.includes(filter));
    });
    if (commands.length > 0) {
      grouped.set(group, commands);
    }
  }
  
  return grouped;
});

// 扁平化的过滤后命令列表（用于键盘导航）
const filteredCommands = computed(() => {
  const commands: Command[] = [];
  for (const cmdList of groupedCommands.value.values()) {
    commands.push(...cmdList);
  }
  return commands;
});

// 处理输入事件，检测斜杠命令
const handleInput = () => {
  const text = inputText.value;
  
  // 检查是否在输入命令（以 / 开头，且在当前行的开头）
  if (text.startsWith('/')) {
    // 提取命令过滤文本（/ 后面的内容，直到空格或行尾）
    const spaceIndex = text.indexOf(' ');
    const filterText = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
    
    // 只有在没有空格时才显示命令菜单（即还在输入命令名称）
    if (spaceIndex === -1) {
      commandFilter.value = filterText;
      showCommandMenu.value = true;
      selectedCommandIndex.value = 0;
      return;
    }
  }
  
  // 不显示命令菜单
  showCommandMenu.value = false;
  commandFilter.value = '';
};

// 处理输入框聚焦事件
const handleFocus = () => {
  const text = inputText.value;
  if (text.startsWith('/') && !text.includes(' ')) {
    commandFilter.value = text.slice(1);
    showCommandMenu.value = true;
    selectedCommandIndex.value = 0;
  }
};

// 处理命令菜单的键盘事件
const handleCommandMenuKeyDown = (event: KeyboardEvent) => {
  if (!showCommandMenu.value) return false;
  
  const commands = filteredCommands.value;
  if (commands.length === 0) return false;
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedCommandIndex.value = (selectedCommandIndex.value + 1) % commands.length;
      scrollToSelectedCommand();
      return true;
      
    case 'ArrowUp':
      event.preventDefault();
      selectedCommandIndex.value = (selectedCommandIndex.value - 1 + commands.length) % commands.length;
      scrollToSelectedCommand();
      return true;
      
    case 'Enter':
      event.preventDefault();
      selectCommand(commands[selectedCommandIndex.value]);
      return true;
      
    case 'Escape':
      event.preventDefault();
      showCommandMenu.value = false;
      return true;
      
    case 'Tab':
      event.preventDefault();
      selectCommand(commands[selectedCommandIndex.value]);
      return true;
      
    default:
      return false;
  }
};

// 选择命令
const selectCommand = (command: Command) => {
  inputText.value = `/${command.name} `;
  showCommandMenu.value = false;
  commandFilter.value = '';
  
  // 聚焦输入框并将光标移到末尾
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      const textarea = inputRef.value.textarea;
      if (textarea) {
        const length = inputText.value.length;
        textarea.setSelectionRange(length, length);
      }
    }
  });
};

// 滚动到选中的命令项
const scrollToSelectedCommand = () => {
  nextTick(() => {
    const selectedElement = document.querySelector('.command-item-active');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  });
};

// 点击外部关闭命令菜单
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.command-menu') && !target.closest('.chat-input')) {
    showCommandMenu.value = false;
  }
};

// 监听命令过滤变化，重置选中索引
watch(commandFilter, () => {
  selectedCommandIndex.value = 0;
});

// 添加/移除点击外部事件监听
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

// 组件卸载时移除事件监听（Vue 3 自动处理，但为明确起见）
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// 智能滚动相关
const messagesListRef = ref<HTMLElement | null>(null);  // 消息列表容器 ref
const isUserScrolledUp = ref(false);                     // 用户是否手动上滚
const showScrollToBottom = ref(false);                   // 是否显示"回到底部"按钮
const SCROLL_THRESHOLD = 100;                            // 判断是否在底部的阈值（像素）

// 节流滚动
let scrollRafId: number | null = null;

// 判断滚动容器是否在底部附近
const isNearBottom = () => {
  const el = messagesListRef.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
};

// 滚动到底部
const scrollToBottomFn = (smooth: boolean = true) => {
  const el = messagesListRef.value;
  if (!el) return;
  el.scrollTo({
    top: el.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant',
  });
};

// 使用 requestAnimationFrame 节流滚动
const requestScrollToBottom = () => {
  if (scrollRafId !== null) return;
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null;
    if (!isUserScrolledUp.value) {
      scrollToBottomFn(false);  // 流式中用 instant 避免 smooth 堆叠
    }
  });
};

// 监听滚动事件，判断用户是否手动上滚
const handleScroll = () => {
  const nearBottom = isNearBottom();
  isUserScrolledUp.value = !nearBottom;
  showScrollToBottom.value = !nearBottom;
};

// 点击"回到底部"按钮
const onScrollToBottomClick = () => {
  isUserScrolledUp.value = false;
  scrollToBottomFn(true);
};

// 用户消息列表（用于导航）
const userMessages = computed(() => {
  return messages.value
    .filter(msg => msg.role === 'user')
    .map((msg, index) => ({
      id: msg.id,
      roundIndex: index + 1,
      content: msg.content,
      timestamp: msg.timestamp
    }));
});

// 流式内容变化时的智能滚动
watch([currentStreamContent, currentStreamReasoning], () => {
  if (!isUserScrolledUp.value) {
    nextTick(() => {
      requestScrollToBottom();
    });
  }
});

// 消息列表变化时的智能滚动
watch(messages, async () => {
  await nextTick();
  if (!isStreaming.value) {
    // 非流式状态（新消息、删除等），始终滚动到底部
    scrollToBottomFn(true);
  } else if (!isUserScrolledUp.value) {
    // 流式中且用户未上滚
    requestScrollToBottom();
  }
});

const toggleCollapse = (key: string) => {
  if (key.startsWith('reasoning-')) {
    const messageId = key.replace('reasoning-', '');
    collapsedReasoning.value[messageId] = !collapsedReasoning.value[messageId];
  } else if (key.startsWith('tools-')) {
    const messageId = key.replace('tools-', '');
    collapsedTools.value[messageId] = !collapsedTools.value[messageId];
  }
};

const formatToolArguments = (args: string) => {
  try {
    const parsed = JSON.parse(args);
    return JSON.stringify(parsed, null, 2);
  } catch (error) {
    return args;
  }
};

const displayContent = (message: Message) => {
  const isLastAssistantMessage = isStreaming.value && 
    message.role === 'assistant' && 
    messages.value.length > 0 && 
    messages.value[messages.value.length - 1].id === message.id;
  
  if (isLastAssistantMessage && currentStreamContent.value) {
    return currentStreamContent.value;
  }
  return message.content;
};

const displayReasoning = (message: Message): string => {
  const isLastAssistantMessage = isStreaming.value &&
    message.role === 'assistant' &&
    messages.value.length > 0 &&
    messages.value[messages.value.length - 1].id === message.id;
  
  if (isLastAssistantMessage && currentStreamReasoning.value) {
    return currentStreamReasoning.value;
  }
  return message.reasoning_content || '';
};

const renderMarkdown = (content: string) => {
  try {
    return marked(content);
  } catch (error) {
    console.error('Markdown render error:', error);
    return content;
  }
};

/**
 * 高亮显示用户消息中的斜杠命令
 * 将 /command 格式的文本包装为带样式的 span 标签
 */
const highlightCommands = (content: string): string => {
  // 构建所有有效命令名称的正则表达式（包括别名）
  const commandNames = COMMANDS.flatMap(cmd => [cmd.name, ...(cmd.aliases || [])]);
  const pattern = new RegExp(`/(${commandNames.join('|')})(?=\\s|$|[^\\w])`, 'gi');
  
  // 转义 HTML 特殊字符，防止 XSS
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  // 分割文本，高亮命令部分
  const parts = content.split(pattern);
  const matches = content.match(pattern) || [];
  
  let result = '';
  let matchIndex = 0;
  
  for (let i = 0; i < parts.length; i++) {
    // 添加非命令文本（已转义）
    result += escapeHtml(parts[i]);
    
    // 如果有匹配的命令，添加高亮版本
    if (matchIndex < matches.length && i < parts.length - 1) {
      const cmd = matches[matchIndex];
      result += `<span class="command-highlight">${escapeHtml(cmd)}</span>`;
      matchIndex++;
    }
  }
  
  return result;
};

const handleKeyDown = (event: KeyboardEvent) => {
  // 先处理命令菜单的键盘事件
  if (handleCommandMenuKeyDown(event)) {
    return;
  }
  
  // Shift+Enter 允许正常换行
  if (event.shiftKey) {
    return;
  }
  // 单独按 Enter 发送消息
  event.preventDefault();
  handleSend();
};

const handleSend = async () => {
  if (!inputText.value.trim()) return;
  
  try {
    if (!currentChat.value) {
      await createChat('默认对话');
    }
    await sendMessage(inputText.value, {
      systemPrompt: '你是一个专业的小说写作助手。',
      providerName: selectedProvider.value as 'deepseek' | 'openrouter',
      modelName: currentModel.value,
    });
    inputText.value = '';
  } catch (error) {
    console.error('Failed to send message:', error);
  }
};

const handleCancel = () => {
  cancelMessage();
  ElMessage.info('已取消生成');
};

const handleCreateChat = async () => {
  try {
    await createChat('默认对话');
  } catch (error) {
    console.error('Failed to create chat:', error);
  }
};

const handleMessageCommand = async (command: string, message: Message) => {
  if (command === 'delete' && message.id) {
    await deleteMessage(message.id);
  } else if (command === 'saveChapter' && message.role === 'assistant') {
    saveChapterMessage.value = message;
    // 计算下一个章节编号，避免与现有章节冲突
    const maxChapterNumber = chapterStore.chapters.length > 0
      ? Math.max(...chapterStore.chapters.map(c => c.chapterNumber))
      : 0;
    const nextChapterNumber = maxChapterNumber + 1;
    saveChapterTitle.value = `第 ${nextChapterNumber} 章`;
    saveChapterNumber.value = nextChapterNumber;
    saveChapterDialogVisible.value = true;
  }
};

const handleProviderChange = async () => {
  await loadModels(selectedProvider.value);
  await updateSettings({ selectedProvider: selectedProvider.value });
};

const handleModelChange = async () => {
  await updateSettings({ selectedModel: selectedModel.value });
};

const handleReasoningEffortChange = async (value: string) => {
  try {
    await settingsStore.updateSettings({ reasoningEffort: value });
  } catch (error) {
    console.error('Failed to save reasoning effort:', error);
  }
};

const handleSaveChapter = async () => {
  if (!saveChapterMessage.value || !projectStore.currentProject) return;

  try {
    await chapterStore.createChapter(projectStore.currentProject.id, {
      chapterNumber: saveChapterNumber.value,
      title: saveChapterTitle.value,
      content: saveChapterMessage.value.content,
      sourceMessageId: saveChapterMessage.value.id
    });
    saveChapterDialogVisible.value = false;
    saveChapterMessage.value = null;
    saveChapterTitle.value = '';
    saveChapterNumber.value = 1;
    ElMessage.success('章节保存成功');
  } catch (error) {
    console.error('Failed to save chapter:', error);
    ElMessage.error('保存章节失败，请重试');
  }
};

// 获取主旨内容预览（截取前100个字符）
const getThemePreview = (content: string): string => {
  if (!content) return '';
  const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;
  return preview;
};

// 点击主旨预览的处理函数（可选：可以打开主旨编辑对话框）
const handleThemeClick = () => {
  ElMessage.info('主旨已注入到对话中，AI将基于主旨进行回复');
};

// 滚动到指定消息
const scrollToMessage = (messageId: string) => {
  activeMessageId.value = messageId;
  const element = document.getElementById('msg-' + messageId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 添加闪烁效果
    element.classList.add('highlight');
    setTimeout(() => {
      element.classList.remove('highlight');
    }, 2000);
  }
};

onMounted(async () => {
  await loadModels(selectedProvider.value);
});
</script>

<style scoped>
.chat-main {
  flex: 1;
  min-width: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.chat-header {
  border-bottom: 1px solid #e0e0e0;
  padding: 0 16px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 16px;
  font-weight: 500;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-select {
  width: 100px;
}

.model-select {
  width: 260px;
}

.effort-select {
  width: 80px;
}

.model-price {
  float: right;
  color: #909399;
  font-size: 12px;
}

.empty-chat {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.empty-chat-content {
  text-align: center;
  color: #999;
}

.empty-text {
  margin-bottom: 12px;
}

.messages-container {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages-content-wrapper {
  display: flex;
  height: 100%;
  gap: 0;
  position: relative;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.message-nav-panel {
  width: 200px;
  overflow: hidden;
  border-left: 1px solid var(--el-border-color);
  background-color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.message-nav-panel.nav-panel-collapsed {
  width: 48px;
}

.nav-panel-header {
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color);
  background-color: #f5f7fa;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.nav-panel-toggle-btn {
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.nav-panel-toggle-btn:hover {
  background-color: #e6f7ff;
  color: #409eff;
  transform: scale(1.1);
}

.nav-panel-list {
  flex: 1;
  overflow-y: auto;
}

.nav-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s ease;
}

.nav-item:hover {
  background-color: #f5f7fa;
}

.nav-item-active {
  background-color: #e6f7ff;
  border-left: 3px solid #409eff;
}

.nav-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.nav-item-round {
  font-weight: 600;
  color: #409eff;
  font-size: 13px;
}

.nav-item-time {
  font-size: 11px;
  color: #999;
}

.nav-item-content {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-empty {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.message-item {
  width: 100%;
  transition: background-color 0.3s ease;
}

.message-item.highlight {
  animation: messageHighlight 2s ease;
}

@keyframes messageHighlight {
  0% {
    background-color: rgba(64, 158, 255, 0.2);
  }
  100% {
    background-color: transparent;
  }
}

.message-header {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}

.message-role {
  margin-left: 16px;
  font-size: 10px;
  color: #ccc;
}

.message-time {
  margin-left: 8px;
  font-size: 12px;
  color: #666;
}

.message-tokens {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

.message-dropdown {
  margin-left: auto;
}

.user-message {
  white-space: pre-wrap;
  line-height: 1.6;
}

/* 斜杠命令高亮样式 */
.user-message :deep(.command-highlight) {
  display: inline;
  background-color: #e6f7ff;
  color: #1890ff;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.95em;
  font-weight: 600;
  border: 1px solid #91d5ff;
}

.tool-result {
  padding: 8px;
  background: #f0f9eb;
  border-left: 3px solid #67c23a;
  border-radius: 4px;
  font-size: 12px;
}

.tool-result-title {
  font-weight: 600;
  color: #67c23a;
  margin-bottom: 4px;
}

.tool-result-content {
  margin: 0;
  white-space: pre-wrap;
  color: #555;
}

.reasoning-box {
  margin-bottom: 8px;
  padding: 8px;
  background: #fff;
  border-left: 3px solid #409eff;
  border-radius: 4px;
}

.reasoning-header {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.collapse-btn {
  padding: 0;
  min-height: auto;
}

.collapse-text {
  font-size: 12px;
}

.reasoning-content {
  color: #666;
  font-size: 13px;
  line-height: 1.6;
}

.tool-calls-section {
  margin-bottom: 12px;
}

.tool-calls-header {
  font-size: 13px;
  font-weight: 600;
  color: #67c23a;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-call-item {
  margin-bottom: 8px;
  padding: 8px;
  background: #fff;
  border-left: 3px solid #67c23a;
  border-radius: 4px;
}

.tool-call-name {
  font-weight: 600;
  margin-bottom: 4px;
  color: #67c23a;
}

.tool-call-arguments {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  color: #666;
  background: #f9f9f9;
  padding: 8px;
  border-radius: 4px;
}

.answer-box {
  padding: 8px;
  background: #fff;
  border-left: 3px solid #909399;
  border-radius: 4px;
}

.answer-title {
  font-size: 13px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 4px;
}

.chat-footer {
  border-top: 1px solid #e0e0e0;
  padding: 12px;
  height: auto;
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

/* 命令菜单样式 */
.command-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 320px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.command-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.command-menu-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.command-menu-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.command-menu-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.command-group-header {
  padding: 8px 12px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.command-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.command-item:hover,
.command-item-active {
  background-color: var(--el-color-primary-light-9);
}

.command-item-active {
  background-color: var(--el-color-primary-light-8);
}

.command-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.command-name {
  font-weight: 600;
  color: var(--el-color-primary);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.command-label {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.command-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding-left: 0;
}

/* 命令菜单动画 */
.command-menu-fade-enter-active,
.command-menu-fade-leave-active {
  transition: all 0.2s ease;
}

.command-menu-fade-enter-from,
.command-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.chat-input {
  flex: 1;
}

.chat-input :deep(textarea) {
  resize: none;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.theme-preview {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.theme-preview:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.theme-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.theme-preview-icon {
  font-size: 18px;
}

.theme-preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  flex: 1;
}

.theme-preview-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}

.theme-preview-content {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.empty-project {
  flex: 1;
}

.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-content :deep(h1) {
  font-size: 1.5em;
}

.markdown-content :deep(h2) {
  font-size: 1.25em;
}

.markdown-content :deep(h3) {
  font-size: 1.1em;
}

.markdown-content :deep(p) {
  margin: 8px 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
}

.markdown-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 12px 0;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #d0d0d0;
  padding-left: 12px;
  margin: 12px 0;
  color: #666;
}

.markdown-content :deep(a) {
  color: #409eff;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  margin: 12px 0;
  width: 100%;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #e0e0e0;
  padding: 8px 12px;
  text-align: left;
}

.markdown-content :deep(th) {
  background-color: #f5f5f5;
  font-weight: 600;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 16px 0;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
}

/* 加载指示器样式 */
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-top: 8px;
  animation: fadeIn 0.3s ease;
}

.loading-indicator .el-icon {
  color: #409eff;
}

.loading-text {
  font-size: 13px;
  color: #666;
}

/* 流式传输状态指示器样式 */
.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  padding: 2px 8px;
  background: #e6f7ff;
  border-radius: 4px;
  animation: fadeIn 0.3s ease;
}

.streaming-dots {
  display: flex;
  gap: 2px;
}

.streaming-dots .dot {
  width: 4px;
  height: 4px;
  background: #409eff;
  border-radius: 50%;
  animation: dotPulse 1.4s infinite;
}

.streaming-dots .dot:nth-child(1) {
  animation-delay: 0s;
}

.streaming-dots .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.streaming-dots .dot:nth-child(3) {
  animation-delay: 0.4s;
}

.streaming-text {
  font-size: 11px;
  color: #409eff;
  white-space: nowrap;
}

/* 取消按钮样式 */
.cancel-button {
  transition: all 0.3s ease;
}

.cancel-button:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.4);
}

/* 动画定义 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dotPulse {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 回到底部按钮 */
.scroll-to-bottom-btn {
  position: absolute;
  bottom: 30px;
  left: calc(50% - 100px);
  transform: translateX(-50%);
  z-index: 10;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.scroll-to-bottom-btn:hover {
  background: var(--el-color-primary);
  color: white;
  border-color: var(--el-color-primary);
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

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
</style>
