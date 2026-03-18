<template>
  <el-main v-if="currentProject" style="flex: 1; min-width: 400px; display: flex; flex-direction: column; overflow: hidden; padding: 0">
    <el-header style="border-bottom: 1px solid #e0e0e0; padding: 0; height: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 16px">
      <span style="font-size: 16px; font-weight: 500">写作区</span>
      <div style="display: flex; align-items: center; gap: 12px">
        <el-select v-model="selectedProvider" size="small" style="width: 100px" @change="handleProviderChange">
          <el-option label="DeepSeek" value="deepseek" />
          <el-option label="OpenRouter" value="openrouter" />
        </el-select>
        <el-select v-model="selectedModel" size="small" style="width: 260px" filterable :loading="isLoadingModels" @change="handleModelChange" placeholder="选择模型">
          <el-option v-for="model in models" :key="model.id" :label="model.name" :value="model.id">
            <span>{{ model.name }}</span>
            <span v-if="model.price" style="float: right; color: #909399; font-size: 12px">{{ model.price }}</span>
          </el-option>
        </el-select>
        <el-tag size="small" type="info">
          {{ totalTokens }} tokens
        </el-tag>
      </div>
    </el-header>

    <div v-if="!currentChat" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 16px">
      <div style="text-align: center; color: #999">
        <p style="margin-bottom: 12px">暂无对话记录</p>
        <el-button type="primary" @click="handleCreateChat">创建新对话</el-button>
      </div>
    </div>

    <div v-else style="flex: 1; overflow: auto; padding: 16px">
      <div style="display: flex; flex-direction: column; gap: 16px">
        <div
          v-for="(message, index) in messages"
          :key="message.id + index"
          style="width: 100%"
        >
          <div style="display: flex; align-items: center; width: 100%; margin-bottom: 8px">
            <el-tag
              :type="message.role === 'user' ? 'primary' : 'info'"
              size="small"
            >
              {{ message.role === 'user' ? '作者' : 'AI助手' }}
            </el-tag>
            <span style="margin-left: 8px; font-size: 12px; color: #666">
              {{ formatTimestamp(message.timestamp) }}
            </span>
            <span style="margin-left: 8px; font-size: 12px; color: #999">
              ~{{ estimateMessageTokens(message) }} tokens
            </span>
            <el-dropdown
              trigger="click"
              style="margin-left: auto"
              @command="(cmd: string) => handleMessageCommand(cmd, message.id)"
            >
              <el-button :icon="MoreFilled" circle size="small" text />
              <template #dropdown>
                <el-dropdown-menu>
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
            <div v-if="message.role === 'user'" style="white-space: pre-wrap; line-height: 1.6;">
              {{ message.content }}
            </div>
            <div v-if="message.role === 'assistant' && displayReasoning(message)">
              <div style="margin-bottom: 8px; padding: 8px; background: #fff; border-left: 3px solid #409eff; border-radius: 4px;">
                <div style="font-size: 13px; font-weight: 600; color: #409eff; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                  <span>💭 思考过程</span>
                  <el-button link size="small" style="padding: 0; min-height: auto;" @click="toggleCollapse('reasoning-' + message.id)">
                    <span style="font-size: 12px;">{{ collapsedReasoning[message.id] ? '展开' : '收起' }}</span>
                  </el-button>
                </div>
                <div v-if="!collapsedReasoning[message.id]" class="markdown-content" style="color: #666; font-size: 13px; line-height: 1.6;" v-html="renderMarkdown(displayReasoning(message))"></div>
              </div>
            </div>

            <div v-if="message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0">
              <div style="margin-bottom: 12px;">
                <div style="font-size: 13px; font-weight: 600; color: #67c23a; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                  <span>🔧 工具调用 ({{ message.tool_calls.length }})</span>
                  <el-button link size="small" style="padding: 0; min-height: auto;" @click="toggleCollapse('tools-' + message.id)">
                    <span style="font-size: 12px;">{{ collapsedTools[message.id] ? '展开' : '收起' }}</span>
                  </el-button>
                </div>
                <div v-if="!collapsedTools[message.id]">
                  <div v-for="(toolCall, i) in message.tool_calls" :key="i" style="margin-bottom: 8px; padding: 8px; background: #fff; border-left: 3px solid #67c23a; border-radius: 4px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #67c23a;">{{ toolCall.function.name }}</div>
                    <pre style="margin: 0; white-space: pre-wrap; font-size: 12px; color: #666; background: #f9f9f9; padding: 8px; border-radius: 4px;">{{ formatToolArguments(toolCall.function.arguments) }}</pre>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="message.role === 'assistant' && displayContent(message)">
              <div style="padding: 8px; background: #fff; border-left: 3px solid #909399; border-radius: 4px;">
                <div style="font-size: 13px; font-weight: 600; color: #909399; margin-bottom: 4px;">✍️ 回答</div>
                <div v-if="isStreaming && message.role === 'assistant' && index === messages.length - 1" class="markdown-content" v-html="renderMarkdown(displayContent(message))"></div>
                <div v-else class="markdown-content" v-html="renderMarkdown(displayContent(message))"></div>
              </div>
            </div>
          </el-card>
        </div>
        <div ref="messagesEndRef"></div>
      </div>
    </div>

    <el-footer style="border-top: 1px solid #e0e0e0; padding: 12px; height: auto; flex-shrink: 0">
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="3"
        placeholder="输入您的问题或写作需求..."
        :disabled="isLoading || !currentChat"
        @keydown.enter.prevent="handleSend"
      >
        <template #append>
          <el-button
            :icon="Promotion"
            @click="handleSend"
            :disabled="!inputText.trim() || isLoading || !currentChat"
          />
        </template>
      </el-input>
    </el-footer>
  </el-main>
  <el-empty v-else description="请先选择或创建一个项目" style="flex: 1" />
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import type { Message } from '../../shared/types';
import { storeToRefs } from 'pinia';
import { Promotion, MoreFilled } from '@element-plus/icons-vue';
import { useChatStore } from '../stores/chatStore';
import { useProjectStore } from '../stores/projectStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useCharacterStore } from '../stores/characterStore';
import { useSettingsStore } from '../stores/settingsStore';
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

const { chats, currentChat, messages, isLoading, isStreaming, currentStreamContent, currentStreamReasoning, totalTokens } = storeToRefs(chatStore);
const { currentProject } = storeToRefs(projectStore);
const { nodes: timelineNodes, selectedNode } = storeToRefs(timelineStore);
const { characters, selectedCharacters } = storeToRefs(characterStore);
const { selectedProvider, selectedModel, models, isLoadingModels } = storeToRefs(settingsStore);
const { loadModels, updateSettings } = settingsStore;

const { createChat, sendMessage, deleteMessage } = chatStore;

const currentModel = computed(() => selectedModel.value || 'deepseek-reasoner');

const inputText = ref('');
const messagesEndRef = ref<HTMLElement | null>(null);
const collapsedReasoning = ref<Record<string, boolean>>({});
const collapsedTools = ref<Record<string, boolean>>({});

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

const displayReasoning = (message: Message) => {
  const isLastAssistantMessage = isStreaming.value && 
    message.role === 'assistant' && 
    messages.value.length > 0 && 
    messages.value[messages.value.length - 1].id === message.id;
  
  if (isLastAssistantMessage && currentStreamReasoning.value) {
    return currentStreamReasoning.value;
  }
  return message.reasoning_content;
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
      providerName: selectedProvider.value,
      modelName: currentModel.value,
      timelineId: selectedNode.value?.id,
      characterIds: Array.from(selectedCharacters.value),
    });
    inputText.value = '';
  } catch (error) {
    console.error('Failed to send message:', error);
  }
};

const handleCreateChat = async () => {
  try {
    await createChat('默认对话');
  } catch (error) {
    console.error('Failed to create chat:', error);
  }
};

const handleMessageCommand = async (command: string, messageId: string) => {
  if (command === 'delete' && messageId) {
    await deleteMessage(messageId);
  }
};

const handleProviderChange = async () => {
  await loadModels(selectedProvider.value);
  await updateSettings({ selectedProvider: selectedProvider.value });
};

const handleModelChange = async () => {
  await updateSettings({ selectedModel: selectedModel.value });
};

onMounted(async () => {
  await loadModels(selectedProvider.value);
});
</script>

<style scoped>
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
</style>
