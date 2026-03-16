import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Message, Chat } from '../../shared/types';
import { chatApi, messageApi, llmApi } from '../utils/api';
import { generateId, estimateConversationTokens } from '../../shared/utils';
import { buildSystemPrompt } from '../utils/prompts';
import { ChatOptions, AssistantAction } from './chatStoreTypes';
import { useProjectStore } from './projectStore';
import { useTimelineStore } from './timelineStore';
import { useCharacterStore } from './characterStore';
import { useSettingsStore } from './settingsStore';

const parseAssistantActions = (content: string): AssistantAction[] => {
  const actions: AssistantAction[] = [];
  const regex = /```action\s*([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const actionJson = match[1].trim();
      const action = JSON.parse(actionJson);
      if (action.type && action.data) {
        actions.push(action);
      }
    } catch (e) {
      console.error('Failed to parse action:', match[0], e);
    }
  }

  if (actions.length > 0) {
    console.warn('⚠️ Security Warning: Executing AI-generated actions automatically. Consider adding user confirmation for safety.');
  }

  return actions;
};

export const useChatStore = defineStore('chat', () => {
  const chats = ref<Chat[]>([]);
  const currentChat = ref<Chat | null>(null);
  const messages = ref<Message[]>([]);
  const isLoading = ref(false);
  const isStreaming = ref(false);
  const currentStreamContent = ref('');
  const currentStreamReasoning = ref('');
  const totalTokens = ref(0);

  const loadChats = async (projectId: string) => {
    try {
      const response = await chatApi.list(projectId);
      chats.value = response.data;

      if (chats.value.length > 0) {
        if (!currentChat.value) {
          await selectChat(chats.value[0].id);
        } else {
          const exists = chats.value.some(c => c.id === currentChat.value!.id);
          if (!exists) {
            await selectChat(chats.value[0].id);
          } else {
            await loadMessages(currentChat.value!.id);
          }
        }
      } else {
        currentChat.value = null;
        messages.value = [];
        totalTokens.value = 0;
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      throw error;
    }
  };

  const loadMessages = async (chatId: string) => {
    const response = await messageApi.list(chatId);
    messages.value = response.data.map((m: any, i: number) => ({
      ...m,
      orderIndex: i + 1,
    }));
    updateTokenCount();
  };

  const updateTokenCount = () => {
    const messagesForTokens = messages.value.map(m => ({
      role: m.role,
      content: m.content,
    }));
    totalTokens.value = estimateConversationTokens(messagesForTokens);
  };

  const createChat = async (title: string) => {
    const projectStore = useProjectStore();
    if (!projectStore.currentProject) throw new Error('No project selected');

    try {
      const response = await chatApi.create(projectStore.currentProject.id, { name: title });
      const chat = response.data;
      chats.value.unshift(chat);
      currentChat.value = chat;
      messages.value = [];
      totalTokens.value = 0;

      return chat;
    } catch (error) {
      console.error('Failed to create chat:', error);
      throw error;
    }
  };

  const selectChat = async (chatId: string | null) => {
    if (!chatId) {
      currentChat.value = null;
      messages.value = [];
      updateTokenCount();
      return;
    }

    const chat = chats.value.find(c => c.id === chatId);
    if (chat) {
      currentChat.value = chat;
      await loadMessages(chatId);
    }
  };

  const sendMessage = async (content: string, options: ChatOptions = {}) => {
    const projectStore = useProjectStore();
    const timelineStore = useTimelineStore();
    const characterStore = useCharacterStore();
    const settingsStore = useSettingsStore();

    if (!currentChat.value || !projectStore.currentProject) {
      throw new Error('No chat or project selected');
    }

    const providerName = options.providerName || 'deepseek';
    const apiKey = providerName === 'deepseek'
      ? settingsStore.deepseekApiKey
      : settingsStore.openrouterApiKey;

    if (!apiKey) {
      throw new Error(`请先配置 ${providerName === 'deepseek' ? 'DeepSeek' : 'OpenRouter'} API 密钥`);
    }

    isLoading.value = true;
    isStreaming.value = true;
    currentStreamContent.value = '';
    currentStreamReasoning.value = '';

    const userMessageId = generateId();
    const userMessage: Message = {
      id: userMessageId,
      chatId: currentChat.value.id,
      role: 'user',
      content,
      timestamp: Date.now(),
      orderIndex: messages.value.length + 1,
    };

    messages.value.push(userMessage);
    updateTokenCount();

    const userResponse = await messageApi.create(currentChat.value.id, {
      role: 'user',
      content,
    });
    const userMessageIndex = messages.value.findIndex(m => m.id === userMessageId);
    if (userMessageIndex !== -1) {
      messages.value[userMessageIndex].id = userResponse.data.id;
    }

    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      chatId: currentChat.value.id,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      orderIndex: messages.value.length + 1,
    };
    messages.value.push(assistantMessage);

    const selectedTimelineNodes = timelineStore.nodes.filter(n => timelineStore.selectedNodes.has(n.id));
    const selectedCharacters = characterStore.characters.filter(c => characterStore.selectedCharacters.has(c.id));

    const systemPrompt = buildSystemPrompt(
      options.systemPrompt,
      selectedTimelineNodes.map(n => ({ id: n.id, title: n.title, description: n.description })),
      selectedCharacters.map(c => ({ id: c.id, name: c.name, description: c.description, personality: c.personality }))
    );

    const messagesForLLM: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (systemPrompt) {
      messagesForLLM.push({ role: 'system', content: systemPrompt });
    }

    const validMessages = messages.value
      .filter(m => m.id !== assistantMessageId && m.content && m.content.trim())
      .map(m => ({
        role: m.role,
        content: m.content,
      }));

    messagesForLLM.push(...validMessages);

    try {
      const response = await llmApi.chat(
        providerName,
        messagesForLLM,
        {
          model: options.modelName,
          temperature: settingsStore.temperature,
          apiKey
        }
      );

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let fullReasoning = '';

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
              const reasoning_content = parsed.reasoning_content;
              if (content) {
                fullContent += content;
                currentStreamContent.value = fullContent;
              }
              if (reasoning_content) {
                fullReasoning += reasoning_content;
                currentStreamReasoning.value = fullReasoning;
              }
            } catch {
            }
          }
        }
      }

      const lastMessageIndex = messages.value.findIndex(m => m.id === assistantMessageId);
      if (lastMessageIndex !== -1) {
        messages.value[lastMessageIndex] = {
          ...messages.value[lastMessageIndex],
          content: fullContent,
          reasoning_content: fullReasoning || undefined,
        };
      }

      const assistantResponse = await messageApi.create(currentChat.value.id, {
        role: 'assistant',
        content: fullContent,
        reasoning_content: fullReasoning || undefined,
      });

      const newMessageIndex = messages.value.findIndex(m => m.id === assistantMessageId);
      if (newMessageIndex !== -1) {
        messages.value[newMessageIndex].id = assistantResponse.data.id;
      }

      const assistantActions = parseAssistantActions(fullContent);

      for (const action of assistantActions) {
        try {
          await executeAssistantAction(action);
        } catch (e) {
          console.error('Failed to execute action:', action, e);
        }
      }

      updateTokenCount();

      isLoading.value = false;
      isStreaming.value = false;
      currentStreamContent.value = '';
      currentStreamReasoning.value = '';
    } catch (error) {
      console.error('Send message error:', error);
      isLoading.value = false;
      isStreaming.value = false;
      currentStreamContent.value = '';
      currentStreamReasoning.value = '';
      throw error;
    }
  };

  const deleteMessage = async (messageId: string) => {
    await messageApi.delete(messageId);
    messages.value = messages.value.filter(m => m.id !== messageId);
    updateTokenCount();
  };

  const clearHistory = async () => {
    if (!currentChat.value) return;

    try {
      await Promise.all(
        messages.value.map(m => messageApi.delete(m.id))
      );
      messages.value = [];
      updateTokenCount();
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  };

  const executeAssistantAction = async (action: AssistantAction) => {
    const timelineStore = useTimelineStore();
    const characterStore = useCharacterStore();

    switch (action.type) {
      case 'create_timeline':
        await timelineStore.createNode(action.data.title, action.data.description);
        break;
      case 'update_timeline':
        if (action.data.id) {
          await timelineStore.updateNode(action.data.id, {
            title: action.data.title,
            content: action.data.description,
          });
        }
        break;
      case 'delete_timeline':
        if (action.data.id) {
          await timelineStore.deleteNode(action.data.id);
        }
        break;
      case 'create_character':
        await characterStore.createCharacter({
          name: action.data.name,
          personality: action.data.personality,
          background: action.data.background,
          relationships: action.data.relationships,
          avatar: action.data.avatar || '',
        });
        break;
      case 'update_character':
        if (action.data.id) {
          await characterStore.updateCharacter(action.data.id, {
            name: action.data.name,
            personality: action.data.personality,
            background: action.data.background,
            relationships: action.data.relationships,
            avatar: action.data.avatar,
          });
        }
        break;
      case 'delete_character':
        if (action.data.id) {
          await characterStore.deleteCharacter(action.data.id);
        }
        break;
    }
  };

  return {
    chats,
    currentChat,
    messages,
    isLoading,
    isStreaming,
    currentStreamContent,
    currentStreamReasoning,
    totalTokens,
    loadChats,
    loadMessages,
    createChat,
    selectChat,
    sendMessage,
    deleteMessage,
    clearHistory,
  };
});
