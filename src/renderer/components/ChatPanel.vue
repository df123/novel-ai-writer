<template>
  <el-container v-if="currentProject" style="flex: 1; min-width: 400px">
    <el-header style="border-bottom: 1px solid #e0e0e0; padding: 0">
      <div style="padding: 12px 16px; font-size: 16px; font-weight: 500">
        写作区
      </div>
    </el-header>

    <el-main style="flex: 1; overflow: auto; padding: 16px">
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
                  <div style="white-space: pre-wrap; color: #666; font-size: 13px">{{ displayReasoning(message) }}</div>
                </el-collapse-item>
              </el-collapse>
            </div>
            <div v-if="isStreaming && message.role === 'assistant' && index === messages.length - 1 && currentStreamContent" style="white-space: pre-wrap">
              {{ currentStreamContent }}
            </div>
            <div v-else style="white-space: pre-wrap">{{ message.content }}</div>
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
    </el-main>

    <el-footer style="border-top: 1px solid #e0e0e0; padding: 12px">
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="3"
        placeholder="输入您的问题或写作需求..."
        :disabled="isLoading"
        @keydown.enter.prevent="handleSend"
      >
        <template #append>
          <el-button
            :icon="Promotion"
            @click="handleSend"
            :disabled="!inputText.trim() || isLoading"
          />
        </template>
      </el-input>
    </el-footer>
  </el-container>
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
import { formatTimestamp } from '../../shared/utils';

const chatStore = useChatStore();
const projectStore = useProjectStore();
const timelineStore = useTimelineStore();
const characterStore = useCharacterStore();

const { chats, currentChat, messages, isLoading, isStreaming, currentStreamContent, currentStreamReasoning } = storeToRefs(chatStore);
const { currentProject } = storeToRefs(projectStore);
const { nodes: timelineNodes, selectedNode } = storeToRefs(timelineStore);
const { characters, selectedCharacters } = storeToRefs(characterStore);

const { createChat, selectChat, sendMessage, deleteMessage } = chatStore;

const inputText = ref('');
const messagesEndRef = ref<HTMLElement | null>(null);

watch([currentStreamContent, currentStreamReasoning], ([newContent, newReasoning]) => {
  console.log('Stream content changed:', newContent?.length || 0, 'chars');
  console.log('Stream reasoning changed:', newReasoning?.length || 0, 'chars');
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
});

onMounted(async () => {
  if (currentProject.value && chats.value.length === 0) {
    await createChat('默认对话');
  }
});

watch(messages, async () => {
  await nextTick();
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
});

watch(
  () => [currentProject.value, chats.value.length],
  async ([project, chatsLength]) => {
    if (project && chatsLength === 0) {
      await createChat('默认对话');
    }
  }
);

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

const handleSend = async () => {
  if (!inputText.value.trim()) return;

  try {
    await sendMessage(inputText.value, {
      systemPrompt: '你是一个专业的小说写作助手。',
      providerName: 'deepseek',
      modelName: 'deepseek-reasoner',
      timelineId: selectedNode.value?.id,
      characterIds: Array.from(selectedCharacters.value),
    });
    inputText.value = '';
  } catch (error) {
    console.error('Failed to send message:', error);
  }
};

const handleMessageCommand = async (command: string, messageId: string) => {
  if (command === 'delete' && messageId) {
    await deleteMessage(messageId);
  }
};
</script>
