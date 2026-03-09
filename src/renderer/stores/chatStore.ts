import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Message, Chat } from '../../shared/types';
import { chatApi, messageApi, llmApi } from '../utils/api';
import { generateId } from '../../shared/utils';
import { useProjectStore } from './projectStore';
import { useTimelineStore } from './timelineStore';
import { useCharacterStore } from './characterStore';

export const useChatStore = defineStore('chat', () => {
  const chats = ref<Chat[]>([]);
  const currentChat = ref<Chat | null>(null);
  const messages = ref<Message[]>([]);
  const isLoading = ref(false);
  const isStreaming = ref(false);
  const currentStreamContent = ref('');

  const loadChats = async (projectId: string) => {
    const response = await chatApi.list(projectId);
    chats.value = response.data;
    
    if (chats.value.length > 0 && !currentChat.value) {
      selectChat(chats.value[0].id);
    }
  };

  const loadMessages = async (chatId: string) => {
    const response = await messageApi.list(chatId);
    messages.value = response.data.map((m: any, i: number) => ({
      ...m,
      orderIndex: i + 1,
    }));
  };

  const createChat = async (title: string) => {
    const projectStore = useProjectStore();
    if (!projectStore.currentProject) throw new Error('No project selected');

    const response = await chatApi.create(projectStore.currentProject.id, { name: title });
    const chat = response.data;
    chats.value.unshift(chat);
    currentChat.value = chat;
    messages.value = [];
    
    return chat;
  };

  const selectChat = (chatId: string | null) => {
    if (!chatId) {
      currentChat.value = null;
      messages.value = [];
      return;
    }

    const chat = chats.value.find(c => c.id === chatId);
    if (chat) {
      currentChat.value = chat;
      loadMessages(chatId);
    }
  };

  const sendMessage = async (content: string, options: any = {}) => {
    const projectStore = useProjectStore();
    const timelineStore = useTimelineStore();
    const characterStore = useCharacterStore();
    
    if (!currentChat.value || !projectStore.currentProject) {
      throw new Error('No chat or project selected');
    }

    isLoading.value = true;
    isStreaming.value = true;
    currentStreamContent.value = '';

    const userMessage: Message = {
      id: generateId(),
      chatId: currentChat.value.id,
      role: 'user',
      content,
      timestamp: Date.now(),
      orderIndex: messages.value.length + 1,
    };

    messages.value.push(userMessage);

    let systemPrompt = options.systemPrompt || '';
    
    if (timelineStore.nodes.length > 0) {
      const timelineSummary = timelineStore.nodes
        .map((node, i) => `${i + 1}. ${node.title}: ${node.content || '无内容'}`)
        .join('\n');
      systemPrompt += `\n\n当前时间线：\n${timelineSummary}`;
    }
    
    if (characterStore.characters.length > 0) {
      const characterSummary = characterStore.characters
        .map(char => `${char.name}: ${char.description || '无描述'}; 性格: ${char.personality || '未知'}`)
        .join('\n');
      systemPrompt += `\n\n涉及角色：\n${characterSummary}`;
    }

    const messagesForLLM: any[] = [];
    
    if (systemPrompt) {
      messagesForLLM.push({ role: 'system', content: systemPrompt });
    }
    
    messagesForLLM.push(...messages.value.map(m => ({
      role: m.role,
      content: m.content,
    })));

    try {
      const response = await llmApi.chat(
        options.providerName || 'openai',
        messagesForLLM,
        { model: options.modelName }
      );

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.content;
              if (content) {
                fullContent += content;
                currentStreamContent.value = fullContent;
              }
            } catch (e) {
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: generateId(),
        chatId: currentChat.value.id,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
        orderIndex: messages.value.length + 1,
      };

      await messageApi.create(currentChat.value.id, {
        role: 'assistant',
        content: fullContent,
      });

      await messageApi.create(currentChat.value.id, {
        role: 'user',
        content,
      });

      messages.value.push(assistantMessage);
      isLoading.value = false;
      isStreaming.value = false;
      currentStreamContent.value = '';
    } catch (error) {
      console.error('Send message error:', error);
      isLoading.value = false;
      isStreaming.value = false;
      currentStreamContent.value = '';
      throw error;
    }
  };

  const deleteMessage = async (messageId: string) => {
    await messageApi.delete(messageId);
    messages.value = messages.value.filter(m => m.id !== messageId);
  };

  const clearHistory = () => {
    if (!currentChat.value) return;

    for (const message of messages.value) {
      messageApi.delete(message.id);
    }
    
    messages.value = [];
  };

  return {
    chats,
    currentChat,
    messages,
    isLoading,
    isStreaming,
    currentStreamContent,
    loadChats,
    loadMessages,
    createChat,
    selectChat,
    sendMessage,
    deleteMessage,
    clearHistory,
  };
});
