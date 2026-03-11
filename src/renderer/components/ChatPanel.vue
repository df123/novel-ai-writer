<template>
  <el-main v-if="currentProject" style="flex: 1; min-width: 400px; display: flex; flex-direction: column; overflow: hidden; padding: 0">
    <el-header style="border-bottom: 1px solid #e0e0e0; padding: 0; height: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 16px">
      <span style="font-size: 16px; font-weight: 500">写作区</span>
      <div style="display: flex; align-items: center; gap: 12px">
        <el-select v-model="selectedProvider" size="small" style="width: 120px">
          <el-option label="DeepSeek" value="deepseek" />
          <el-option label="OpenAI" value="openai" />
          <el-option label="OpenRouter" value="openrouter" />
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
            <div v-if="message.role === 'assistant' && displayReasoning(message)">
              <el-collapse>
                <el-collapse-item title="思考过程" name="reasoning">
                  <div class="markdown-content" style="color: #666; font-size: 13px" v-html="renderMarkdown(displayReasoning(message))"></div>
                </el-collapse-item>
              </el-collapse>
            </div>
            <div v-if="isStreaming && message.role === 'assistant' && index === messages.length - 1 && currentStreamContent" class="markdown-content" v-html="renderMarkdown(currentStreamContent)"></div>
            <div v-else class="markdown-content" v-html="renderMarkdown(message.content)"></div>
          </el-card>
        </div>
        <div v-if="isStreaming" style="padding: 12px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 4px">
          <div style="font-weight: bold; margin-bottom: 8px">流式传输调试信息:</div>
          <div>Content: {{ currentStreamContent.length }} chars</div>
          <div>Reasoning: {{ currentStreamReasoning.length }} chars</div>
          <div v-if="currentStreamContent" style="margin-top: 8px; max-height: 100px; overflow: auto; font-size: 12px">
            {{ currentStreamContent }}
          </div>
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
const { selectedProvider } = storeToRefs(settingsStore);

const { createChat, sendMessage, deleteMessage } = chatStore;

const providerModels = {
  deepseek: 'deepseek-reasoner',
  openai: 'gpt-3.5-turbo',
  openrouter: 'openai/gpt-3.5-turbo',
};

const currentModel = computed(() => providerModels[selectedProvider.value] || 'deepseek-reasoner');

const inputText = ref('');
const messagesEndRef = ref<HTMLElement | null>(null);

watch([currentStreamContent, currentStreamReasoning], ([newContent, newReasoning]) => {
  console.log('Stream content changed:', newContent?.length || 0, 'chars');
  console.log('Stream reasoning changed:', newReasoning?.length || 0, 'chars');
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
});

watch(messages, async () => {
  await nextTick();
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
});

const displayContent = (message: Message) => {
  const isLastAssistantMessage = isStreaming.value && 
    message.role === 'assistant' && 
    messages.value.length > 0 && 
    messages.value[messages.value.length - 1].id === message.id;
  
  if (isLastAssistantMessage) {
    return currentStreamContent.value;
  }
  return message.content;
};

const displayReasoning = (message: Message) => {
  const isLastAssistantMessage = isStreaming.value && 
    message.role === 'assistant' && 
    messages.value.length > 0 && 
    messages.value[messages.value.length - 1].id === message.id;
  
  if (isLastAssistantMessage) {
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
