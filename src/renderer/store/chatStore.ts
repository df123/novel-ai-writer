import { create } from 'zustand';
import { Message, Chat } from '../../shared/types';
import { chatApi, messageApi, llmApi } from '../utils/api';
import { generateId } from '../../shared/utils';
import { useProjectStore } from './projectStore';
import { useTimelineStore } from './timelineStore';
import { useCharacterStore } from './characterStore';

interface ChatState {
  chats: Chat[];
  currentChat: Chat | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  currentStreamContent: string;
  
  loadChats: (projectId: string) => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  createChat: (title: string) => Promise<Chat>;
  selectChat: (chatId: string | null) => void;
  sendMessage: (content: string, options?: any) => Promise<void>;
  deleteMessage: (messageId: string) => void;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChat: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  currentStreamContent: '',

  loadChats: async (projectId: string) => {
    const response = await chatApi.list(projectId);
    const chats = response.data;
    set({ chats });
    
    if (chats.length > 0 && !get().currentChat) {
      get().selectChat(chats[0].id);
    }
  },

  loadMessages: async (chatId: string) => {
    const response = await messageApi.list(chatId);
    const messages = response.data.map((m: any, i: number) => ({
      ...m,
      orderIndex: i + 1,
    }));
    set({ messages });
  },

  createChat: async (title: string) => {
    const { currentProject } = useProjectStore.getState();
    if (!currentProject) throw new Error('No project selected');

    const response = await chatApi.create(currentProject.id, { name: title });
    const chat = response.data;
    set(state => ({
      chats: [chat, ...state.chats],
      currentChat: chat,
      messages: [],
    }));
    
    return chat;
  },

  selectChat: (chatId: string | null) => {
    if (!chatId) {
      set({ currentChat: null, messages: [] });
      return;
    }

    const chat = get().chats.find(c => c.id === chatId);
    if (chat) {
      set({ currentChat: chat });
      get().loadMessages(chatId);
    }
  },

  sendMessage: async (content: string, options: any = {}) => {
    const { currentChat } = get();
    const { currentProject } = useProjectStore.getState();
    const { timelineNodes } = useTimelineStore.getState();
    const { characters } = useCharacterStore.getState();
    
    if (!currentChat || !currentProject) throw new Error('No chat or project selected');

    set({ isLoading: true, isStreaming: true, currentStreamContent: '' });

    const userMessage: Message = {
      id: generateId(),
      chatId: currentChat.id,
      role: 'user',
      content,
      timestamp: Date.now(),
      orderIndex: get().messages.length + 1,
    };

    set(state => ({ messages: [...state.messages, userMessage] }));

    // 构建系统提示词
    let systemPrompt = options.systemPrompt || '';
    
    // 添加时间线上下文
    if (timelineNodes.length > 0) {
      const timelineSummary = timelineNodes
        .map((node, i) => `${i + 1}. ${node.title}: ${node.content || '无内容'}`)
        .join('\n');
      systemPrompt += `\n\n当前时间线：\n${timelineSummary}`;
    }
    
    // 添加角色上下文
    if (characters.length > 0) {
      const characterSummary = characters
        .map(char => `${char.name}: ${char.description || '无描述'}; 性格: ${char.personality || '未知'}`)
        .join('\n');
      systemPrompt += `\n\n涉及角色：\n${characterSummary}`;
    }

    // 准备消息历史
    const messagesForLLM: any[] = [];
    
    if (systemPrompt) {
      messagesForLLM.push({ role: 'system', content: systemPrompt });
    }
    
    messagesForLLM.push(...get().messages.map(m => ({
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
                set({ currentStreamContent: fullContent });
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      // 保存助手消息
      const assistantMessage: Message = {
        id: generateId(),
        chatId: currentChat.id,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
        orderIndex: get().messages.length + 1,
      };

      await messageApi.create(currentChat.id, {
        role: 'assistant',
        content: fullContent,
      });

      // 同时保存用户消息
      await messageApi.create(currentChat.id, {
        role: 'user',
        content,
      });

      set(state => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        isStreaming: false,
        currentStreamContent: '',
      }));
    } catch (error) {
      console.error('Send message error:', error);
      set({ isLoading: false, isStreaming: false, currentStreamContent: '' });
      throw error;
    }
  },

  deleteMessage: async (messageId: string) => {
    await messageApi.delete(messageId);
    set(state => ({
      messages: state.messages.filter(m => m.id !== messageId),
    }));
  },

  clearHistory: () => {
    const { currentChat, messages } = get();
    if (!currentChat) return;

    for (const message of messages) {
      messageApi.delete(message.id);
    }
    
    set({ messages: [] });
  },
}));
