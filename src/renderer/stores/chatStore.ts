import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Message, Chat } from '../../shared/types';
import { chatApi, messageApi, llmApi } from '../utils/api';
import { generateId, estimateConversationTokens } from '../../shared/utils';
import { buildSystemPrompt } from '../utils/prompts';
import { ALL_TOOLS } from '../utils/tools';
import { ChatOptions } from './chatStoreTypes';
import { useProjectStore } from './projectStore';
import { useTimelineStore } from './timelineStore';
import { useCharacterStore } from './characterStore';
import { useSettingsStore } from './settingsStore';

/**
 * 工具调用接口
 */
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  index: number;
}

/**
 * 流式响应块接口
 */
interface StreamChunk {
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: ToolCall[];
    };
  }>;
}

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
    let assistantMessageId: string | null = null;

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
      messages.value = messages.value.map((m, i) =>
        i === userMessageIndex ? { ...m, id: userResponse.data.id } : m
      );
    }

    const selectedTimelineNodes = timelineStore.nodes.filter(n => timelineStore.selectedNodes.has(n.id));
    const selectedCharacters = characterStore.characters.filter(c => characterStore.selectedCharacters.has(c.id));

    const systemPrompt = buildSystemPrompt(
      options.systemPrompt,
      selectedTimelineNodes.map(n => ({ id: n.id, title: n.title, description: n.description })),
      selectedCharacters.map(c => ({ id: c.id, name: c.name, description: c.description, personality: c.personality })),
      providerName === 'deepseek' ? ALL_TOOLS : undefined
    );

    const validMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; reasoning_content?: string; tool_calls?: ToolCall[]; tool_call_id?: string }> = messages.value
      .filter(m => m.role !== 'system' && m.role !== 'tool' && m.content && m.content.trim())
      .map(m => ({
        role: m.role,
        content: m.content,
      }));

    const baseMessagesForLLM: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; reasoning_content?: string; tool_calls?: ToolCall[]; tool_call_id?: string }> = [];

    if (systemPrompt) {
      baseMessagesForLLM.push({ role: 'system', content: systemPrompt });
    }

    baseMessagesForLLM.push(...validMessages);

    const executeToolCall = async (toolCall: ToolCall): Promise<string> => {
      const { name, arguments: args } = toolCall.function;
      const parsedArgs = JSON.parse(args);

      console.log(`Executing tool: ${name}`, parsedArgs);

      try {
        switch (name) {
          case 'create_timeline': {
            const existingTimeline = timelineStore.nodes.find(n => n.title === parsedArgs.title);
            if (existingTimeline) {
              return JSON.stringify({ 
                success: false, 
                message: `时间线节点"${parsedArgs.title}"已存在，请使用update_timeline工具更新它`,
                existingData: {
                  id: existingTimeline.id,
                  title: existingTimeline.title,
                  description: existingTimeline.description || '',
                },
                suggestion: '使用 update_timeline 工具，传入上述 id 来更新此时间线节点'
              });
            }
            await timelineStore.createNode(parsedArgs.title, parsedArgs.description);
            return JSON.stringify({ success: true, message: `Created timeline node: ${parsedArgs.title}` });
          }
          case 'update_timeline': {
            if (parsedArgs.id) {
              await timelineStore.updateNode(parsedArgs.id, {
                title: parsedArgs.title,
                content: parsedArgs.description,
              });
              return JSON.stringify({ success: true, message: `Updated timeline node: ${parsedArgs.title}` });
            }
            return JSON.stringify({ success: false, message: 'Missing required id' });
          }
          case 'delete_timeline': {
            if (parsedArgs.id) {
              await timelineStore.deleteNode(parsedArgs.id);
              return JSON.stringify({ success: true, message: `Deleted timeline node` });
            }
            return JSON.stringify({ success: false, message: 'Missing required id' });
          }
          case 'create_character': {
            const existingCharacter = characterStore.characters.find(c => c.name === parsedArgs.name);
            if (existingCharacter) {
              return JSON.stringify({ 
                success: false, 
                message: `人物"${parsedArgs.name}"已存在，请使用update_character工具更新它`,
                existingData: {
                  id: existingCharacter.id,
                  name: existingCharacter.name,
                  description: existingCharacter.description || '',
                  personality: existingCharacter.personality || '',
                  background: existingCharacter.background || '',
                  relationships: existingCharacter.relationships || '',
                },
                suggestion: '使用 update_character 工具，传入上述 id 来更新此人物'
              });
            }
            await characterStore.createCharacter({
              name: parsedArgs.name,
              personality: parsedArgs.personality,
              background: parsedArgs.background,
              relationships: parsedArgs.relationships,
              description: parsedArgs.description,
            });
            return JSON.stringify({ success: true, message: `Created character: ${parsedArgs.name}` });
          }
          case 'update_character': {
            if (parsedArgs.id) {
              await characterStore.updateCharacter(parsedArgs.id, {
                name: parsedArgs.name,
                personality: parsedArgs.personality,
                background: parsedArgs.background,
                relationships: parsedArgs.relationships,
                description: parsedArgs.description,
              });
              return JSON.stringify({ success: true, message: `Updated character: ${parsedArgs.name}` });
            }
            return JSON.stringify({ success: false, message: 'Missing required id' });
          }
          case 'delete_character': {
            if (parsedArgs.id) {
              await characterStore.deleteCharacter(parsedArgs.id);
              return JSON.stringify({ success: true, message: `Deleted character` });
            }
            return JSON.stringify({ success: false, message: 'Missing required id' });
          }
          default:
            return JSON.stringify({ success: false, message: `Unknown tool: ${name}` });
        }
      } catch (error) {
        console.error(`Failed to execute tool ${name}:`, error);
        return JSON.stringify({ success: false, message: `Error: ${error}` });
      }
    };

    const runLLMTurn = async (
      currentMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; reasoning_content?: string; tool_calls?: ToolCall[]; tool_call_id?: string }>,
      saveMessage: boolean = true
    ): Promise<void> => {

      const response = await llmApi.chat(
        providerName,
        currentMessages,
        {
          model: options.modelName,
          temperature: settingsStore.temperature,
          apiKey,
          tools: providerName === 'deepseek' ? ALL_TOOLS : undefined,
          thinking: providerName === 'deepseek' ? { type: 'enabled' } : undefined,
        }
      );

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let fullReasoning = '';
      const accumulatedToolCalls: Record<number, ToolCall> = {};
      
      assistantMessageId = generateId();
      if (currentChat.value) {
        const assistantMessage: Message = {
          id: assistantMessageId,
          chatId: currentChat.value.id,
          role: 'assistant',
          content: '',
          reasoning_content: undefined,
          tool_calls: undefined,
          timestamp: Date.now(),
          orderIndex: messages.value.length + 1,
        };
        messages.value.push(assistantMessage);
      }
      currentStreamContent.value = '';
      currentStreamReasoning.value = '';

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
              const parsed = JSON.parse(data) as StreamChunk;
              const delta = parsed.choices[0]?.delta;

              if (delta?.content) {
                fullContent += delta.content;
                currentStreamContent.value = fullContent;
              }
              if (delta?.reasoning_content) {
                fullReasoning += delta.reasoning_content;
                currentStreamReasoning.value = fullReasoning;
              }
              console.log('Stream delta:', { content: delta?.content, reasoning: delta?.reasoning_content });
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index;
                  if (!accumulatedToolCalls[index]) {
                    accumulatedToolCalls[index] = {
                      id: toolCall.id,
                      type: toolCall.type,
                      index: toolCall.index,
                      function: {
                        name: toolCall.function.name || '',
                        arguments: '',
                      },
                    };
                  }
                  if (toolCall.function.arguments) {
                    accumulatedToolCalls[index].function.arguments += toolCall.function.arguments;
                  }
                }
              }
            } catch (e) {
              console.error('Failed to parse stream chunk:', e, data);
            }
          }
        }
      }

      console.log('LLM response - fullContent:', fullContent, 'fullReasoning:', fullReasoning, 'toolCalls:', Object.values(accumulatedToolCalls));

      const toolCalls = Object.values(accumulatedToolCalls);
      
      let finalContent = '';
      let finalReasoning = undefined as string | undefined;
      
      if (toolCalls.length > 0) {
        finalContent = '';
        finalReasoning = fullReasoning;
      } else if (!fullContent && fullReasoning) {
        finalContent = fullReasoning;
        finalReasoning = undefined;
      } else {
        finalContent = fullContent;
        finalReasoning = fullReasoning || undefined;
      }

      if (currentChat.value && (finalContent || finalReasoning || toolCalls.length > 0)) {
        const msgIndex = messages.value.findIndex(m => m.id === assistantMessageId);
        if (msgIndex !== -1) {
          messages.value = messages.value.map((m, i) => 
            i === msgIndex ? { 
              ...m, 
              content: finalContent,
              reasoning_content: finalReasoning,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            } : m
          );
        }

        if (saveMessage) {
          const assistantResponse = await messageApi.create(currentChat.value.id, {
            role: 'assistant',
            content: finalContent,
            reasoning_content: finalReasoning,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          });
          const newMessageIndex = messages.value.findIndex(m => m.id === assistantMessageId);
          if (newMessageIndex !== -1) {
            messages.value = messages.value.map((m, i) =>
              i === newMessageIndex ? { ...m, id: assistantResponse.data.id } : m
            );
          }
          assistantMessageId = assistantResponse.data.id;
        }

        const newMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; reasoning_content?: string; tool_calls?: ToolCall[]; tool_call_id?: string }> = [
          ...currentMessages,
          {
            role: 'assistant',
            content: finalContent,
            reasoning_content: finalReasoning,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          },
        ];

        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const result = await executeToolCall(toolCall);
            newMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result,
            });
          }

          await runLLMTurn(newMessages, true);
        } else {
          updateTokenCount();
          isLoading.value = false;
          isStreaming.value = false;
          currentStreamContent.value = '';
          currentStreamReasoning.value = '';
        }
      } else {
        const msgIndex = messages.value.findIndex(m => m.id === assistantMessageId);
        if (msgIndex !== -1) {
          messages.value = messages.value.filter(m => m.id !== assistantMessageId);
        }
        updateTokenCount();
        isLoading.value = false;
        isStreaming.value = false;
        currentStreamContent.value = '';
        currentStreamReasoning.value = '';
      }
    };

    try {
      await runLLMTurn(baseMessagesForLLM, true);
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
