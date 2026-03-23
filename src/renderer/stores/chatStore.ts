import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Message, Chat, TimelineNode, Character, Chapter } from '../../shared/types';
import { chatApi, messageApi, llmApi, timelineApi, characterApi } from '../utils/api';
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
  const chapterContext = ref<Chapter | null>(null);

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

    let systemPrompt = buildSystemPrompt(
      options.systemPrompt,
      [],
      [],
      ALL_TOOLS
    );

    // 如果有章节上下文，将章节内容添加到系统提示中
    if (chapterContext.value) {
      const chapterPrompt = `\n\n【章节上下文】\n第 ${chapterContext.value.chapterNumber} 章：${chapterContext.value.title}\n\n${chapterContext.value.content}\n\n请基于以上章节内容进行回复。`;
      systemPrompt += chapterPrompt;
    }

    const validMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; reasoning_content?: string; tool_calls?: ToolCall[]; tool_call_id?: string }> = messages.value
      .filter(m => m.role !== 'system')
      .filter(m => 
        m.role === 'tool' || 
        (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) ||
        (m.content && m.content.trim())
      )
      .map(m => {
        if (m.role === 'tool') {
          return { role: m.role as 'tool', tool_call_id: m.tool_call_id, content: m.content };
        }
        if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
          return { role: m.role as 'assistant', content: m.content || '', reasoning_content: m.reasoning_content, tool_calls: m.tool_calls };
        }
        return { role: m.role, content: m.content, reasoning_content: m.reasoning_content };
      });

    const baseMessagesForLLM: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content?: string; reasoning_content?: string; tool_calls?: ToolCall[]; tool_call_id?: string }> = [];

    if (systemPrompt) {
      baseMessagesForLLM.push({ role: 'system', content: systemPrompt });
    }

    baseMessagesForLLM.push(...validMessages);

    const executeToolCall = async (toolCall: ToolCall): Promise<string> => {
      const { name, arguments: args } = toolCall.function;
      const parsedArgs = JSON.parse(args);

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
            await timelineStore.createNode(parsedArgs.title, parsedArgs.description, { date: parsedArgs.date });
            return JSON.stringify({ success: true, message: `已创建时间线节点: ${parsedArgs.title}` });
          }
          case 'update_timeline': {
            if (!parsedArgs.id) {
              // 自动获取所有时间线节点
              const nodes = timelineStore.nodes.map(n => ({
                id: n.id,
                title: n.title,
                description: n.content || '',
              }));
              return JSON.stringify({ 
                success: false, 
                message: '缺少必需的 id 参数',
                hint: '请先调用 get_timeline() 获取所有时间线节点的 ID 列表，或使用 get_timeline(id="xxx") 获取特定节点',
                example: 'get_timeline() 或 get_timeline(id="节点ID")',
                availableNodes: nodes.length > 0 ? nodes : undefined,
                suggestion: nodes.length > 0 
                  ? `当前有 ${nodes.length} 个时间线节点，请选择要更新的节点并使用其 ID 调用 update_timeline`
                  : '当前没有时间线节点，请先使用 create_timeline 创建'
              });
            }
            
            // 验证 id 是否存在
            const node = timelineStore.nodes.find(n => n.id === parsedArgs.id);
            if (!node) {
              return JSON.stringify({ 
                success: false, 
                message: `未找到时间线节点: ${parsedArgs.id}`,
                hint: '请先调用 get_timeline() 获取所有时间线节点的 ID 列表',
                availableNodes: timelineStore.nodes.map(n => ({
                  id: n.id,
                  title: n.title,
                  description: n.content || '',
                }))
              });
            }
            
            await timelineStore.updateNode(parsedArgs.id, {
              title: parsedArgs.title,
              content: parsedArgs.description,
              createVersion: true,
            });
            return JSON.stringify({ success: true, message: `已更新时间线节点: ${parsedArgs.title || node.title}` });
          }
          case 'delete_timeline': {
            if (!parsedArgs.id) {
              const nodes = timelineStore.nodes.map(n => ({
                id: n.id,
                title: n.title,
                description: n.content || '',
              }));
              return JSON.stringify({ 
                success: false, 
                message: '缺少必需的 id 参数',
                hint: '请先调用 get_timeline() 获取所有时间线节点的 ID 列表',
                example: 'get_timeline() 或 get_timeline(id="节点ID")',
                availableNodes: nodes.length > 0 ? nodes : undefined,
                suggestion: nodes.length > 0 
                  ? `当前有 ${nodes.length} 个时间线节点，请选择要删除的节点并使用其 ID 调用 delete_timeline`
                  : '当前没有时间线节点'
              });
            }
            
            const node = timelineStore.nodes.find(n => n.id === parsedArgs.id);
            if (!node) {
              return JSON.stringify({ 
                success: false, 
                message: `未找到时间线节点: ${parsedArgs.id}`,
                hint: '请先调用 get_timeline() 获取所有时间线节点的 ID 列表',
                availableNodes: timelineStore.nodes.map(n => ({
                  id: n.id,
                  title: n.title,
                  description: n.content || '',
                }))
              });
            }
            
            await timelineStore.deleteNode(parsedArgs.id);
            return JSON.stringify({ success: true, message: `已删除时间线节点: ${node.title}` });
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
            });
            return JSON.stringify({ success: true, message: `已创建人物: ${parsedArgs.name}` });
          }
          case 'update_character': {
            if (!parsedArgs.id) {
              // 自动获取所有人物
              const characters = characterStore.characters.map(c => ({
                id: c.id,
                name: c.name,
                personality: c.personality || '',
                background: c.background || '',
                relationships: c.relationships || '',
              }));
              return JSON.stringify({ 
                success: false, 
                message: '缺少必需的 id 参数',
                hint: '请先调用 get_character() 获取所有人物的 ID 列表，或使用 get_character(id="xxx") 获取特定人物',
                example: 'get_character() 或 get_character(id="人物ID")',
                availableCharacters: characters.length > 0 ? characters : undefined,
                suggestion: characters.length > 0 
                  ? `当前有 ${characters.length} 个人物，请选择要更新的人物并使用其 ID 调用 update_character`
                  : '当前没有人物，请先使用 create_character 创建'
              });
            }
            
            // 验证 id 是否存在
            const character = characterStore.characters.find(c => c.id === parsedArgs.id);
            if (!character) {
              return JSON.stringify({ 
                success: false, 
                message: `未找到人物: ${parsedArgs.id}`,
                hint: '请先调用 get_character() 获取所有人物的 ID 列表',
                availableCharacters: characterStore.characters.map(c => ({
                  id: c.id,
                  name: c.name,
                  personality: c.personality || '',
                  background: c.background || '',
                  relationships: c.relationships || '',
                }))
              });
            }
            
            await characterStore.updateCharacter(parsedArgs.id, {
              name: parsedArgs.name,
              personality: parsedArgs.personality,
              background: parsedArgs.background,
              relationships: parsedArgs.relationships,
              createVersion: true,
            });
            return JSON.stringify({ success: true, message: `已更新人物: ${parsedArgs.name || character.name}` });
          }
          case 'delete_character': {
            if (!parsedArgs.id) {
              const characters = characterStore.characters.map(c => ({
                id: c.id,
                name: c.name,
                personality: c.personality || '',
                background: c.background || '',
                relationships: c.relationships || '',
              }));
              return JSON.stringify({ 
                success: false, 
                message: '缺少必需的 id 参数',
                hint: '请先调用 get_character() 获取所有人物的 ID 列表',
                example: 'get_character() 或 get_character(id="人物ID")',
                availableCharacters: characters.length > 0 ? characters : undefined,
                suggestion: characters.length > 0 
                  ? `当前有 ${characters.length} 个人物，请选择要删除的人物并使用其 ID 调用 delete_character`
                  : '当前没有人物'
              });
            }
            
            const character = characterStore.characters.find(c => c.id === parsedArgs.id);
            if (!character) {
              return JSON.stringify({ 
                success: false, 
                message: `未找到人物: ${parsedArgs.id}`,
                hint: '请先调用 get_character() 获取所有人物的 ID 列表',
                availableCharacters: characterStore.characters.map(c => ({
                  id: c.id,
                  name: c.name,
                  personality: c.personality || '',
                  background: c.background || '',
                  relationships: c.relationships || '',
                }))
              });
            }
            
            await characterStore.deleteCharacter(parsedArgs.id);
            return JSON.stringify({ success: true, message: `已删除人物: ${character.name}` });
          }
          case 'get_timeline': {
            // 检查是否选择了项目
            if (!projectStore.currentProject) {
              return JSON.stringify({ 
                success: false, 
                message: '未选择项目，请先选择一个项目' 
              });
            }

            try {
              if (parsedArgs.id) {
                // 使用 API 获取指定 ID 的时间线节点
                const response = await timelineApi.get(parsedArgs.id);
                const node = response.data;
                if (node) {
                  return JSON.stringify({
                    success: true,
                    data: {
                      id: node.id,
                      title: node.title,
                      description: node.content || '',
                    },
                  });
                }
                return JSON.stringify({ success: false, message: `未找到时间线节点: ${parsedArgs.id}` });
              } else {
                // 使用 API 进行服务器端筛选，避免重复筛选
                const filters: { title?: string; content?: string } = {};
                
                // 验证并添加筛选条件（仅非空字符串）
                if (parsedArgs.title && parsedArgs.title.trim()) {
                  filters.title = parsedArgs.title.trim();
                }
                
                if (parsedArgs.content && parsedArgs.content.trim()) {
                  filters.content = parsedArgs.content.trim();
                }
                
                // 从 API 获取筛选后的结果
                const response = await timelineApi.list(projectStore.currentProject.id, filters);
                const nodes = response.data.map((n: TimelineNode) => ({
                  id: n.id,
                  title: n.title,
                  description: n.content || '',
                }));
                
                return JSON.stringify({
                  success: true,
                  data: nodes,
                  count: nodes.length,
                  filters: {
                    title: filters.title || null,
                    content: filters.content || null,
                  },
                });
              }
            } catch (error) {
              console.error('[get_timeline] Failed to fetch timeline nodes:', error);
              return JSON.stringify({ 
                success: false, 
                message: '获取时间线节点失败，请稍后重试' 
              });
            }
          }
          case 'get_character': {
            // 检查是否选择了项目
            if (!projectStore.currentProject) {
              return JSON.stringify({ 
                success: false, 
                message: '未选择项目，请先选择一个项目' 
              });
            }

            try {
              if (parsedArgs.id) {
                // 使用 API 获取指定 ID 的人物
                const response = await characterApi.get(parsedArgs.id);
                const character = response.data;
                if (character) {
                  return JSON.stringify({
                    success: true,
                    data: {
                      id: character.id,
                      name: character.name,
                      description: character.description || '',
                      personality: character.personality || '',
                      background: character.background || '',
                      relationships: character.relationships || '',
                    },
                  });
                }
                return JSON.stringify({ success: false, message: `未找到人物: ${parsedArgs.id}` });
              } else {
                // 使用 API 进行服务器端筛选，避免重复筛选
                const filters: { name?: string; description?: string; personality?: string; background?: string } = {};
                
                // 验证并添加筛选条件（仅非空字符串）
                if (parsedArgs.name && parsedArgs.name.trim()) {
                  filters.name = parsedArgs.name.trim();
                }
                
                if (parsedArgs.description && parsedArgs.description.trim()) {
                  filters.description = parsedArgs.description.trim();
                }
                
                if (parsedArgs.personality && parsedArgs.personality.trim()) {
                  filters.personality = parsedArgs.personality.trim();
                }
                
                if (parsedArgs.background && parsedArgs.background.trim()) {
                  filters.background = parsedArgs.background.trim();
                }
                
                // 从 API 获取筛选后的结果
                const response = await characterApi.list(projectStore.currentProject.id, filters);
                const characters = response.data.map((c: Character) => ({
                  id: c.id,
                  name: c.name,
                  personality: c.personality || '',
                  background: c.background || '',
                  relationships: c.relationships || '',
                }));
                
                return JSON.stringify({
                  success: true,
                  data: characters,
                  count: characters.length,
                  filters: {
                    name: filters.name || null,
                    description: filters.description || null,
                    personality: filters.personality || null,
                    background: filters.background || null,
                  },
                });
              }
            } catch (error) {
              console.error('[get_character] Failed to fetch characters:', error);
              return JSON.stringify({ 
                success: false, 
                message: '获取人物失败，请稍后重试' 
              });
            }
          }
          default:
            return JSON.stringify({ success: false, message: `Unknown tool: ${name}` });
        }
      } catch (error) {
        console.error(`[Tool Execution] Failed to execute tool ${name}:`, error);
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
          tools: ALL_TOOLS,
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
      let buffer = '';

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

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
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

      const toolCalls = Object.values(accumulatedToolCalls);
      
      let finalContent = '';
      let finalReasoning = undefined as string | undefined;
      
      if (toolCalls.length > 0) {
        finalContent = '';
        finalReasoning = fullReasoning;
      } else if (!fullContent && fullReasoning) {
        console.warn('Unexpected: reasoning without content or tool_calls - treating reasoning as content');
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
            
            if (saveMessage && currentChat.value) {
              const toolResponse = await messageApi.create(currentChat.value.id, {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result,
              });
              messages.value.push({
                id: toolResponse.data.id,
                chatId: currentChat.value.id,
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result,
                timestamp: Date.now(),
                orderIndex: messages.value.length + 1,
              });
            }
            
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

  function setChapterContext(chapter: Chapter | null) {
    chapterContext.value = chapter;
  }

  function clearChapterContext() {
    chapterContext.value = null;
  }

  return {
    chats,
    currentChat,
    messages,
    isLoading,
    isStreaming,
    currentStreamContent,
    currentStreamReasoning,
    totalTokens,
    chapterContext,
    loadChats,
    loadMessages,
    createChat,
    selectChat,
    sendMessage,
    deleteMessage,
    clearHistory,
    setChapterContext,
    clearChapterContext,
  };
});
