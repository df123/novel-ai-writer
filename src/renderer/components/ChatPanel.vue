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
        <el-tag size="small" type="info">
          {{ totalTokens }} tokens
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
      <div class="messages-list">
        <div
          v-for="(message, index) in messages"
          :key="message.id + index"
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
            <div v-if="message.role === 'user'" class="user-message">
              {{ message.content }}
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
      </div>
    </div>

    <el-footer class="chat-footer">
      <div class="input-wrapper">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入您的问题或写作需求..."
          :disabled="isLoading || !currentChat"
          @keydown.enter.prevent="handleSend"
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
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import type { Message } from '../../shared/types';
import { storeToRefs } from 'pinia';
import { Promotion, MoreFilled, Close, Loading } from '@element-plus/icons-vue';
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
const { selectedProvider, selectedModel, models, isLoadingModels } = storeToRefs(settingsStore);
const { theme: currentTheme } = storeToRefs(themeStore);
const { loadModels, updateSettings } = settingsStore;

const { createChat, sendMessage, cancelMessage, deleteMessage } = chatStore;

const currentModel = computed(() => selectedModel.value || 'deepseek-reasoner');

const inputText = ref('');
const messagesEndRef = ref<HTMLElement | null>(null);
const collapsedReasoning = ref<Record<string, boolean>>({});
const collapsedTools = ref<Record<string, boolean>>({});
const saveChapterDialogVisible = ref(false);
const saveChapterMessage = ref<Message | null>(null);
const saveChapterTitle = ref('');
const saveChapterNumber = ref(1);

watch([currentStreamContent, currentStreamReasoning], ([newContent, newReasoning]) => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
});

watch(messages, async () => {
  await nextTick();
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
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
  overflow: auto;
  padding: 16px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-item {
  width: 100%;
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
</style>
