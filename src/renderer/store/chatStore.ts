import { create } from 'zustand';
import { Message, Chat } from '../../shared/types';
import { ipcClient } from '../utils/ipc';
import { generateId } from '../../shared/utils';
import { useProjectStore } from './projectStore';

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
    const chats = await ipcClient.chat.getAll(projectId);
    set({ chats });
    
    if (chats.length > 0 && !get().currentChat) {
      get().selectChat(chats[0].id);
    }
  },

  loadMessages: async (chatId: string) => {
    const messages = await ipcClient.chat.getMessages(chatId);
    set({ messages });
  },

  createChat: async (title: string) => {
    const { currentProject } = useProjectStore.getState();
    if (!currentProject) throw new Error('No project selected');

    const chat = await ipcClient.chat.create(currentProject.id, title);
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
    const { currentChat, currentStreamContent } = get();
    const { currentProject } = useProjectStore.getState();
    
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

    const sendOptions = {
      chatId: currentChat.id,
      content,
      role: 'user',
      systemPrompt: options.systemPrompt || '',
      providerName: options.providerName || 'openai',
      modelName: options.modelName || 'gpt-3.5-turbo',
      timelineId: options.timelineId,
      characterIds: options.characterIds,
    };

    try {
      const assistantMessage = await ipcClient.chat.sendMessage(sendOptions);
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

  deleteMessage: (messageId: string) => {
    ipcClient.chat.deleteMessage(messageId);
    set(state => ({
      messages: state.messages.filter(m => m.id !== messageId),
    }));
  },

  clearHistory: () => {
    const { currentChat } = get();
    if (!currentChat) return;

    ipcClient.chat.clearHistory(currentChat.id);
    set({ messages: [] });
  },
}));
