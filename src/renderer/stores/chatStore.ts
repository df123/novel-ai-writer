import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Message, Chat } from '../../shared/types';
import { chatApi, messageApi, llmApi } from '../utils/api';
import { generateId, estimateConversationTokens } from '../../shared/utils';
import { useProjectStore } from './projectStore';
import { useTimelineStore } from './timelineStore';
import { useCharacterStore } from './characterStore';
import { useSettingsStore } from './settingsStore';

interface AssistantAction {
  type: 'create_timeline' | 'update_timeline' | 'delete_timeline' | 'create_character' | 'update_character' | 'delete_character';
  data: any;
}

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

    const response = await chatApi.create(projectStore.currentProject.id, { name: title });
    const chat = response.data;
    chats.value.unshift(chat);
    currentChat.value = chat;
    messages.value = [];
    totalTokens.value = 0;
    
    return chat;
  };

  const selectChat = async (chatId: string | null) => {
    if (!chatId) {
      currentChat.value = null;
      messages.value = [];
      totalTokens.value = 0;
      return;
    }

    const chat = chats.value.find(c => c.id === chatId);
    if (chat) {
      currentChat.value = chat;
      await loadMessages(chatId);
    }
  };

  const sendMessage = async (content: string, options: any = {}) => {
    const projectStore = useProjectStore();
    const timelineStore = useTimelineStore();
    const characterStore = useCharacterStore();
    const settingsStore = useSettingsStore();
    
    if (!currentChat.value || !projectStore.currentProject) {
      throw new Error('No chat or project selected');
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
    
    await messageApi.create(currentChat.value.id, {
      role: 'user',
      content,
    });

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

    let systemPrompt = options.systemPrompt || '';

    systemPrompt += `

你可以通过在回复中包含特殊格式的 JSON 代码块来修改时间线和人物信息：

1. 创建时间线节点：
\`\`\`action
{"type": "create_timeline", "data": {"title": "标题", "description": "描述内容"}}
\`\`\`

2. 编辑时间线节点：
\`\`\`action
{"type": "update_timeline", "data": {"id": "节点ID", "title": "新标题", "description": "新描述"}}
\`\`\`

3. 删除时间线节点：
\`\`\`action
{"type": "delete_timeline", "data": {"id": "节点ID"}}
\`\`\`

4. 创建人物：
\`\`\`action
{"type": "create_character", "data": {"name": "姓名", "personality": "性格描述", "background": "背景故事", "relationships": "关系"}}
\`\`\`

5. 编辑人物：
\`\`\`action
{"type": "update_character", "data": {"id": "人物ID", "name": "新姓名", "personality": "新性格", "background": "新背景", "relationships": "新关系"}}
\`\`\`

6. 删除人物：
\`\`\`action
{"type": "delete_character", "data": {"id": "人物ID"}}
\`\`\`
`;

    if (timelineStore.nodes.length > 0) {
      const timelineSummary = timelineStore.nodes
        .map((node, i) => `${i + 1}. [ID: ${node.id}] ${node.title}: ${node.description || '无内容'}`)
        .join('\n');
      systemPrompt += `\n\n当前时间线：\n${timelineSummary}`;
    }

    if (characterStore.characters.length > 0) {
      const characterSummary = characterStore.characters
        .map(char => `[ID: ${char.id}] ${char.name}: ${char.description || '无描述'}; 性格: ${char.personality || '未知'}`)
        .join('\n');
      systemPrompt += `\n\n涉及角色：\n${characterSummary}`;
    }

    const messagesForLLM: any[] = [];
    
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
        options.providerName || 'deepseek',
        messagesForLLM,
        { 
          model: options.modelName,
          temperature: settingsStore.temperature
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
                console.log('Stream content updated:', fullContent.length, 'chars');
              }
              if (reasoning_content) {
                fullReasoning += reasoning_content;
                currentStreamReasoning.value = fullReasoning;
                console.log('Stream reasoning updated:', fullReasoning.length, 'chars');
              }
            } catch (e) {
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

      await messageApi.create(currentChat.value.id, {
        role: 'assistant',
        content: fullContent,
        reasoning_content: fullReasoning || undefined,
      });

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

  const clearHistory = () => {
    if (!currentChat.value) return;

    for (const message of messages.value) {
      messageApi.delete(message.id);
    }

    messages.value = [];
    totalTokens.value = 0;
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
          } as any);
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
