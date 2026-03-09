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
          v-for="message in messages"
          :key="message.id"
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
            <div style="white-space: pre-wrap">{{ message.content }}</div>
          </el-card>
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
import { ref, watch, nextTick, onMounted } from 'vue';
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

const { chats, currentChat, messages, isLoading } = storeToRefs(chatStore);
const { currentProject } = storeToRefs(projectStore);
const { nodes: timelineNodes, selectedNode } = storeToRefs(timelineStore);
const { characters, selectedCharacters } = storeToRefs(characterStore);

const { createChat, selectChat, sendMessage, deleteMessage } = chatStore;

const inputText = ref('');
const messagesEndRef = ref<HTMLElement | null>(null);

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
