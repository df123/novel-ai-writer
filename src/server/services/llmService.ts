// LLM API 调用服务
import { randomInt } from 'crypto';
import { CLIPROXY_DEFAULT_BASE_URL, LLM_PROVIDERS } from '../config';
import type { LLMChatMessage } from '../types/service.types';
import type { Model } from '../../shared/types';
import type { Response } from 'express';

/**
 * 聊天流选项接口
 */
interface ChatStreamOptions {
  /** API 密钥 */
  apiKey: string;

  /** 模型名称 */
  model?: string;

  /** 温度参数 */
  temperature?: number;

  /** top_p 参数 */
  topP?: number;

  /** 最大 token 数 */
  maxTokens?: number;

  /** 工具定义数组 */
  tools?: unknown[];

  /** 思考参数（deepseek 专用） */
  thinking?: unknown;

  /** 推理努力程度（deepseek 专用，可选值：high/max） */
  reasoning_effort?: string;

  /** CLI Proxy API 基础地址 */
  cliproxyBaseUrl?: string;

  /** Z.AI 思考强度开关 */
  zaiReasoningEnabled?: boolean;

  /** Z.AI 思考强度 */
  zaiReasoningEffort?: string;

  /** OpenCode 推理开关 */
  opencodeReasoningEnabled?: boolean;

  /** OpenCode 推理强度 */
  opencodeReasoningEffort?: string;

  /** CLI Proxy API 推理开关 */
  cliproxyReasoningEnabled?: boolean;

  /** CLI Proxy API 推理强度 */
  cliproxyReasoningEffort?: string;
}

/**
 * LLM 提供商类型
 */
export type LLMProvider = 'deepseek' | 'openrouter' | 'zai' | 'opencode' | 'cliproxy';

/** OpenCode / Z.AI Coding Plan 的单次输出上限 */
const OPENCODE_MAX_TOKENS = 32000;

/** 未显式传预算时的默认输出上限 */
const DEFAULT_MAX_TOKENS = 4096;

/** Z.AI Coding Plan 需要伪装为 opencode 客户端 */
const OPENCODE_USER_AGENT = 'opencode/1.18.23';

const ZAI_REASONING_EFFORTS = new Set([
  'max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none'
]);

const PROVIDER_NAMES: Record<LLMProvider, string> = {
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  zai: 'Z.AI',
  opencode: 'OpenCode',
  cliproxy: 'CLI Proxy API'
};

/** OpenCode Zen 官方仅支持 Chat Completions 的模型 */
const OPENCODE_ZEN_CHAT_ONLY_MODELS = new Set([
  'deepseek-v4-pro', 'deepseek-v4-flash',
  'minimax-m3', 'minimax-m2.7', 'minimax-m2.5',
  'glm-5.2', 'glm-5.1', 'glm-5',
  'kimi-k2.5', 'kimi-k2.6', 'kimi-k2.7-code', 'kimi-k3',
  'big-pickle', 'x-preview-f-free', 'mimo-v2.5-free', 'hy3-free',
  'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free'
]);

const OPENCODE_ZEN_RESPONSES_MODELS = new Set([
  'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna',
  'gpt-5.5', 'gpt-5.5-pro',
  'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.4-nano',
  'gpt-5.3-codex', 'gpt-5.3-codex-spark',
  'gpt-5.2', 'gpt-5.2-codex',
  'gpt-5.1', 'gpt-5.1-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini',
  'gpt-5', 'gpt-5-codex', 'gpt-5-nano',
  'grok-4.6', 'grok-4.5', 'grok-build-0.1',
  'muse-spark-1.2', 'muse-spark-1.2-contributor-free'
]);

const OPENCODE_ZEN_FREE_MODELS = new Set([
  'big-pickle', 'x-preview-f-free', 'mimo-v2.5-free', 'hy3-free',
  'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free',
  'muse-spark-1.2-contributor-free'
]);

/** OpenCode Go 官方仅支持 Chat Completions 的模型 */
const OPENCODE_GO_CHAT_ONLY_MODELS = new Set([
  'glm-5.3-flash', 'glm-5.3', 'glm-5.2', 'glm-5.1',
  'kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6',
  'longcat-2.0', 'deepseek-v4-pro', 'deepseek-v4-flash',
  'deepseek-v4-flash-vision-exp',
  'mimo-v2.5', 'mimo-v2.5-pro', 'hy3', 'ox-alpha-free'
]);

const OPENCODE_GO_RESPONSES_MODELS = new Set([
  'grok-4.6', 'gpt-5.6-luna', 'muse-spark-1.2-contributor'
]);

const OPENCODE_GO_FREE_MODELS = new Set<string>([]);

const OPENCODE_GO_MODEL_ALIASES: Record<string, string> = {
  'muse-spark-1.2': 'muse-spark-1.2-contributor',
  'muse-spark-1.2-contributor-free': 'muse-spark-1.2-contributor'
};

const OPENCODE_MODEL_NAMES: Record<string, string> = {
  'big-pickle': 'Big Pickle',
  'mimo-v2.5-free': 'MiMo-V2.5 Free',
  'nemotron-3-ultra-free': 'Nemotron 3 Ultra Free',
  'x-preview-f-free': 'Ox Alpha Free',
  'hy3-free': 'Hy3 Free',
  'nemotron-3.5-lightning-free': 'Nemotron 3.5 Lightning Free',
  'longcat-2.0': 'LongCat 2.0',
  'deepseek-v4-flash-vision-exp': 'DeepSeek V4 Flash Vision Exp',
  'grok-4.6': 'Grok 4.6',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'minimax-m3': 'MiniMax M3',
  'minimax-m2.7': 'MiniMax M2.7',
  'minimax-m2.5': 'MiniMax M2.5',
  'glm-5.3': 'GLM-5.3',
  'glm-5.3-flash': 'GLM-5.3 Flash',
  'glm-5.2': 'GLM-5.2',
  'glm-5.1': 'GLM-5.1',
  'glm-5': 'GLM-5',
  'kimi-k2.5': 'Kimi K2.5',
  'kimi-k2.6': 'Kimi K2.6',
  'kimi-k2.7-code': 'Kimi K2.7 Code',
  'kimi-k3': 'Kimi K3',
  'grok-4.5': 'Grok 4.5',
  'gpt-5.6-luna': 'GPT 5.6 Luna',
  'mimo-v2.5': 'MiMo-V2.5',
  'mimo-v2.5-pro': 'MiMo-V2.5-Pro',
  'hy3': 'Hy3',
  'muse-spark-1.2': 'Muse Spark 1.2',
  'muse-spark-1.2-contributor': 'Muse Spark 1.2 Contributor',
  'muse-spark-1.2-contributor-free': 'Muse Spark 1.2 Contributor Free'
};

/** 官方公开过上下文窗口的模型；未知模型保持 undefined，避免编造数据 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'deepseek-v4-flash': 1_048_576,
  'deepseek-v4-pro': 1_048_576,
  'glm-5.2': 1_000_000,
  'glm-5.3': 1_000_000,
  'gpt-5.6-luna': 1_050_000,
  'x-preview-f-free': 1_048_576
};

const OPENCODE_SESSION_ID = createSessionId();

const ZAI_MODEL_NAMES: Record<string, string> = {
  'glm-5.3': 'GLM-5.3',
  'glm-5.3-flash': 'GLM-5.3 Flash',
  'glm-5.2': 'GLM-5.2'
};

const DEEPSEEK_MODEL_NAMES: Record<string, string> = {
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-v4-flash-vision-exp': 'DeepSeek V4 Flash Vision Exp',
  'deepseek-v4-pro': 'DeepSeek V4 Pro'
};

/**
 * OpenRouter 模型响应接口
 */
interface OpenRouterModel {
  id: string;
  name?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  output_modalities?: string[];
  context_length?: number;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>;
}

interface ProviderEndpoint {
  apiUrl: string;
  responsesUrl?: string;
  modelName: string;
  usesResponsesApi: boolean;
}

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

interface ResponsesStreamState {
  functionCallStates: Map<string, {
    index: number;
    emittedArgumentLength: number;
  }>;
  emittedTextLength: number;
  emittedReasoningLength: number;
}

interface ResponsesStreamFailure {
  code: string;
  message: string;
}

interface LLMStreamResult {
  response: FetchResponse;
  usesResponsesApi: boolean;
}

/**
 * 生成 opencode 兼容的 ses_<ULID> 会话 ID
 */
function createSessionId(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let timestamp = Date.now();
  let timestampPart = '';

  for (let i = 0; i < 10; i += 1) {
    timestampPart = alphabet[timestamp & 31] + timestampPart;
    timestamp >>= 5;
  }

  let randomPart = '';
  for (let i = 0; i < 16; i += 1) {
    randomPart += alphabet[randomInt(alphabet.length)];
  }

  return `ses_${timestampPart}${randomPart}`;
}

function normalizeBaseUrl(url: string | undefined): string {
  const normalized = (url || CLIPROXY_DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  return normalized || CLIPROXY_DEFAULT_BASE_URL;
}

function stripPrefix(model: string, prefix: string): string {
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

function limitedMaxTokens(maxTokens?: number): number {
  return Math.min(maxTokens || DEFAULT_MAX_TOKENS, OPENCODE_MAX_TOKENS);
}

function resolveProviderEndpoint(
  provider: LLMProvider,
  model: string,
  cliproxyBaseUrl?: string
): ProviderEndpoint {
  if (provider === 'opencode') {
    if (model.startsWith('opencode-go/')) {
      const modelName = stripPrefix(model, 'opencode-go/');
      const actualModelName = OPENCODE_GO_MODEL_ALIASES[modelName] || modelName;
      return {
        apiUrl: LLM_PROVIDERS.opencode.goApiUrl!,
        modelName: actualModelName,
        usesResponsesApi: !OPENCODE_GO_CHAT_ONLY_MODELS.has(actualModelName),
        responsesUrl: LLM_PROVIDERS.opencode.goResponsesUrl
      };
    }

    const modelName = stripPrefix(model, 'opencode/');
    return {
      apiUrl: LLM_PROVIDERS.opencode.apiUrl,
      modelName,
      usesResponsesApi: !OPENCODE_ZEN_CHAT_ONLY_MODELS.has(modelName),
      responsesUrl: LLM_PROVIDERS.opencode.responsesUrl
    };
  }

  if (provider === 'cliproxy') {
    const baseUrl = normalizeBaseUrl(cliproxyBaseUrl);
    return {
      apiUrl: `${baseUrl}/chat/completions`,
      responsesUrl: `${baseUrl}/responses`,
      modelName: stripPrefix(model, 'cliproxy/'),
      usesResponsesApi: true
    };
  }

  return {
    apiUrl: LLM_PROVIDERS[provider].apiUrl,
    responsesUrl: LLM_PROVIDERS[provider].responsesUrl,
    modelName: model,
    usesResponsesApi: true
  };
}

function buildHeaders(provider: LLMProvider, apiUrl: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (provider === 'zai' || apiUrl.includes('z.ai')) {
    headers['User-Agent'] = OPENCODE_USER_AGENT;
    headers['X-Session-Id'] = OPENCODE_SESSION_ID;
    headers['x-session-affinity'] = OPENCODE_SESSION_ID;
  } else {
    headers['User-Agent'] = 'NovelAI Writer';
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://novelai-writer.local';
    headers['X-OpenRouter-Title'] = 'NovelAI Writer';
  }

  return headers;
}

function cleanMessages(messages: LLMChatMessage[]): Array<Record<string, unknown>> {
  return messages.map(msg => {
    const cleaned: Record<string, unknown> = { role: msg.role };
    if (msg.content !== undefined) cleaned.content = msg.content;
    if (msg.tool_calls) cleaned.tool_calls = msg.tool_calls;
    if (msg.tool_call_id) cleaned.tool_call_id = msg.tool_call_id;
    if (msg.reasoning_content !== undefined && msg.reasoning_content !== null) {
      cleaned.reasoning_content = msg.reasoning_content;
    }
    return cleaned;
  });
}

function buildChatPayload(
  provider: LLMProvider,
  modelName: string,
  messages: Array<Record<string, unknown>>,
  options: ChatStreamOptions
): Record<string, unknown> {
  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages,
    stream: true
  };

  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }

  if (provider === 'zai') {
    requestBody.max_tokens = limitedMaxTokens(options.maxTokens);
    requestBody.thinking = { type: 'enabled', clear_thinking: false };
    requestBody.stream_options = { include_usage: true };
    const effort = options.zaiReasoningEffort || 'max';
    if (
      options.zaiReasoningEnabled &&
      ZAI_REASONING_EFFORTS.has(effort)
    ) {
      requestBody.reasoning_effort = effort;
    }
    return requestBody;
  }

  if (provider === 'opencode') {
    requestBody.max_tokens = limitedMaxTokens(options.maxTokens);
    requestBody.stream_options = { include_usage: true };
    if (options.opencodeReasoningEnabled) {
      const effort = options.opencodeReasoningEffort || 'none';
      if (modelName === 'hy3' || modelName === 'hy3-preview') {
        const effortMap: Record<string, string> = {
          none: 'no_think',
          minimal: 'low',
          low: 'low',
          medium: 'high',
          high: 'high',
          max: 'high'
        };
        requestBody.reasoning_effort = effortMap[effort] || 'high';
      } else if (effort !== 'none') {
        requestBody.reasoning_effort = effort;
      }
    }
    return requestBody;
  }

  requestBody.temperature = options.temperature;
  requestBody.top_p = options.topP;
  requestBody.max_tokens = options.maxTokens;

  if (provider === 'deepseek') {
    if (options.thinking) {
      requestBody.thinking = options.thinking;
    }
    if (options.reasoning_effort) {
      requestBody.reasoning_effort = options.reasoning_effort;
    }
    requestBody.stream_options = { include_usage: true };
  }

  if (provider === 'openrouter' || provider === 'cliproxy') {
    requestBody.stream_options = { include_usage: true };
  }

  if (provider === 'cliproxy' && options.cliproxyReasoningEnabled) {
    const effort = options.cliproxyReasoningEffort || 'auto';
    if (['none', 'low', 'medium', 'high', 'auto'].includes(effort)) {
      requestBody.reasoning_effort = effort;
    }
  }

  return requestBody;
}

function convertToolsForResponses(tools?: unknown[]): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) return undefined;

  return tools.map(tool => {
    const chatTool = tool as {
      function?: {
        name?: string;
        description?: string;
        parameters?: unknown;
      };
    };
    return {
      type: 'function',
      name: chatTool.function?.name || '',
      description: chatTool.function?.description || '',
      parameters: chatTool.function?.parameters || { type: 'object', properties: {} }
    };
  });
}

function toResponseOutput(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content === undefined || content === null) return '';
  return JSON.stringify(content);
}

function buildResponsesPayload(
  provider: LLMProvider,
  modelName: string,
  messages: LLMChatMessage[],
  options: ChatStreamOptions
): Record<string, unknown> {
  const instructions: string[] = [];
  const input: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    if (message.role === 'system') {
      if (message.content) instructions.push(toResponseOutput(message.content));
      continue;
    }

    if (message.role === 'tool') {
      input.push({
        type: 'function_call_output',
        call_id: message.tool_call_id || '',
        output: toResponseOutput(message.content)
      });
      continue;
    }

    const role = ['user', 'assistant', 'developer'].includes(message.role)
      ? message.role
      : 'user';
    input.push({ role, content: message.content ?? '' });

    if (message.role === 'assistant' && message.tool_calls) {
      const toolCalls = message.tool_calls as Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;

      for (const toolCall of toolCalls) {
        const toolArguments = toolCall.function?.arguments;
        input.push({
          type: 'function_call',
          call_id: toolCall.id || '',
          name: toolCall.function?.name || '',
          arguments: typeof toolArguments === 'string'
            ? toolArguments
            : JSON.stringify(toolArguments ?? {})
        });
      }
    }

  }

  const payload: Record<string, unknown> = {
    model: modelName,
    input,
    stream: true
  };

  if (provider === 'opencode' || provider === 'zai') {
    payload.max_output_tokens = limitedMaxTokens(options.maxTokens);
  } else if (options.maxTokens !== undefined) {
    payload.max_output_tokens = options.maxTokens;
  }

  if (provider === 'deepseek' || provider === 'openrouter' || provider === 'cliproxy') {
    if (options.temperature !== undefined) payload.temperature = options.temperature;
    if (options.topP !== undefined) payload.top_p = options.topP;
  }

  if (instructions.length > 0) {
    payload.instructions = instructions.join('\n\n');
  }

  const tools = convertToolsForResponses(options.tools);
  if (tools) {
    payload.tools = tools;
  }

  if (provider === 'deepseek' && options.reasoning_effort) {
    payload.reasoning = { effort: options.reasoning_effort };
  }

  if (provider === 'zai' && options.zaiReasoningEnabled) {
    const effort = options.zaiReasoningEffort || 'max';
    if (ZAI_REASONING_EFFORTS.has(effort)) {
      payload.reasoning = { effort };
    }
  }

  if (provider === 'opencode' && options.opencodeReasoningEnabled) {
    const effort = options.opencodeReasoningEffort || 'none';
    if (effort !== 'none') {
      const effortMap: Record<string, string> = {
        minimal: 'low',
        low: 'low',
        medium: 'high',
        high: 'high',
        max: 'high'
      };
      payload.reasoning = { effort: effortMap[effort] || effort };
    }
  }

  if (provider === 'cliproxy' && options.cliproxyReasoningEnabled) {
    const effort = options.cliproxyReasoningEffort || 'auto';
    if (['none', 'low', 'medium', 'high', 'auto'].includes(effort)) {
      payload.reasoning = { effort };
    }
  }

  return payload;
}

function chatStreamChunk(delta: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
}

function normalizeUsage(
  usage: Record<string, unknown> | undefined
): {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_tokens_details?: { reasoning_tokens: number };
} | undefined {
  if (!usage) return undefined;

  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);
  const outputTokenDetails = usage.output_tokens_details as { reasoning_tokens?: number } | undefined;

  return {
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: totalTokens,
    completion_tokens_details: {
      reasoning_tokens: outputTokenDetails?.reasoning_tokens ?? 0
    }
  };
}

interface ResponsesFunctionCallItem {
  type?: string;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
}

function registerFunctionCall(
  state: ResponsesStreamState,
  item: ResponsesFunctionCallItem
): string {
  const itemKey = item.id || item.call_id || '';
  if (!itemKey || state.functionCallStates.has(itemKey)) return '';

  const index = state.functionCallStates.size;
  state.functionCallStates.set(itemKey, {
    index,
    emittedArgumentLength: 0
  });

  return chatStreamChunk({
    tool_calls: [{
      id: item.call_id || item.id || '',
      type: 'function',
      index,
      function: { name: item.name || '', arguments: '' }
    }]
  });
}

function emitFunctionCallArguments(
  state: ResponsesStreamState,
  itemKey: string,
  argumentsText: string
): string {
  const callState = state.functionCallStates.get(itemKey);
  if (!callState || argumentsText.length <= callState.emittedArgumentLength) return '';

  const remainingArguments = argumentsText.slice(callState.emittedArgumentLength);
  callState.emittedArgumentLength = argumentsText.length;
  return chatStreamChunk({
    tool_calls: [{
      id: '',
      type: 'function',
      index: callState.index,
      function: { name: '', arguments: remainingArguments }
    }]
  });
}

function appendFunctionCallArgumentDelta(
  state: ResponsesStreamState,
  itemKey: string,
  argumentsDelta: string
): string {
  const callState = state.functionCallStates.get(itemKey);
  if (!callState || !argumentsDelta) return '';

  callState.emittedArgumentLength += argumentsDelta.length;
  return chatStreamChunk({
    tool_calls: [{
      id: '',
      type: 'function',
      index: callState.index,
      function: { name: '', arguments: argumentsDelta }
    }]
  });
}

function emitRemainingText(
  text: string,
  emittedLength: number
): { content: string; length: number } | null {
  if (text.length <= emittedLength) return null;
  return {
    content: text.slice(emittedLength),
    length: text.length
  };
}

function extractResponseItemText(item: Record<string, unknown>): string {
  if (item.type === 'message') {
    const content = Array.isArray(item.content) ? item.content : [];
    return content
      .map(part => {
        const contentPart = part as { type?: string; text?: string };
        return contentPart.type === 'output_text' ? String(contentPart.text || '') : '';
      })
      .join('');
  }

  if (item.type === 'reasoning') {
    const summary = Array.isArray(item.summary) ? item.summary : [];
    return summary
      .map(part => {
        const summaryPart = part as { type?: string; text?: string };
        return summaryPart.type === 'summary_text' ? String(summaryPart.text || '') : '';
      })
      .join('');
  }

  return '';
}

function convertResponsesEvent(
  event: Record<string, unknown>,
  state: ResponsesStreamState
): string | null {
  const type = String(event.type || '');

  if (type === 'response.output_text.delta') {
    const content = String(event.delta || '');
    if (!content) return null;
    state.emittedTextLength += content.length;
    return chatStreamChunk({ content });
  }

  if (
    type === 'response.reasoning_summary_text.delta' ||
    type === 'response.reasoning_text.delta'
  ) {
    const reasoningContent = String(event.delta || '');
    if (!reasoningContent) return null;
    state.emittedReasoningLength += reasoningContent.length;
    return chatStreamChunk({ reasoning_content: reasoningContent });
  }

  if (
    type === 'response.output_text.done' ||
    type === 'response.reasoning_summary_text.done' ||
    type === 'response.reasoning_text.done'
  ) {
    const isReasoning = type !== 'response.output_text.done';
    const text = String(event.text || event.delta || '');
    const emitted = isReasoning
      ? emitRemainingText(text, state.emittedReasoningLength)
      : emitRemainingText(text, state.emittedTextLength);
    if (!emitted) return null;

    if (isReasoning) {
      state.emittedReasoningLength = emitted.length;
      return chatStreamChunk({ reasoning_content: emitted.content });
    }

    state.emittedTextLength = emitted.length;
    return chatStreamChunk({ content: emitted.content });
  }

  if (type === 'response.output_item.added') {
    const item = event.item as ResponsesFunctionCallItem | undefined;
    if (item?.type !== 'function_call') return null;

    const addedChunk = registerFunctionCall(state, item);
    const itemKey = item.id || item.call_id || '';
    const argumentsChunk = emitFunctionCallArguments(
      state,
      itemKey,
      String(item.arguments || '')
    );
    return addedChunk + argumentsChunk || null;
  }

  if (type === 'response.output_item.done') {
    const item = event.item as Record<string, unknown> | undefined;
    if (!item) return null;

    if (item.type === 'function_call') {
      const functionCallItem = item as ResponsesFunctionCallItem;
      const addedChunk = registerFunctionCall(state, functionCallItem);
      const itemKey = functionCallItem.id || functionCallItem.call_id || '';
      const argumentsChunk = emitFunctionCallArguments(
        state,
        itemKey,
        String(functionCallItem.arguments || '')
      );
      return addedChunk + argumentsChunk || null;
    }

    const itemText = extractResponseItemText(item);
    if (!itemText) return null;

    if (item.type === 'reasoning') {
      const emitted = emitRemainingText(itemText, state.emittedReasoningLength);
      if (!emitted) return null;
      state.emittedReasoningLength = emitted.length;
      return chatStreamChunk({ reasoning_content: emitted.content });
    }

    const emitted = emitRemainingText(itemText, state.emittedTextLength);
    if (!emitted) return null;
    state.emittedTextLength = emitted.length;
    return chatStreamChunk({ content: emitted.content });
  }

  if (type === 'response.function_call_arguments.delta') {
    const itemId = String(event.item_id || '');
    const argumentsDelta = String(event.delta || '');
    const argumentsChunk = appendFunctionCallArgumentDelta(state, itemId, argumentsDelta);
    return argumentsChunk || null;
  }

  if (type === 'response.function_call_arguments.done') {
    const itemId = String(event.item_id || '');
    const completeArguments = String(event.arguments || '');
    const argumentsChunk = emitFunctionCallArguments(state, itemId, completeArguments);
    return argumentsChunk || null;
  }

  if (type === 'response.content_part.done') {
    const part = event.part as { type?: string; text?: string } | undefined;
    if (part?.type !== 'output_text') return null;

    const emitted = emitRemainingText(String(part.text || ''), state.emittedTextLength);
    if (!emitted) return null;
    state.emittedTextLength = emitted.length;
    return chatStreamChunk({ content: emitted.content });
  }

  if (type === 'response.completed' || type === 'response.incomplete') {
    const response = event.response as { usage?: Record<string, unknown> } | undefined;
    const usage = normalizeUsage(response?.usage);
    return usage ? `data: ${JSON.stringify({ choices: [], usage })}\n\n` : null;
  }

  return null;
}

/** Chat Completions 常见的瞬时故障状态码 */
const CHAT_TRANSIENT_RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Chat Completions 瞬时故障的重试间隔 */
const CHAT_RETRY_DELAYS_MS = [750, 2000];

/** Responses API 常见的瞬时故障状态码 */
const RESPONSES_TRANSIENT_RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Responses API 瞬时故障的重试间隔 */
const RESPONSES_RETRY_DELAYS_MS = [750, 2000];

/** Responses API 在 HTTP 200 的 SSE 事件内返回的瞬时错误码 */
const RESPONSES_STREAM_TRANSIENT_ERROR_CODES = new Set([
  'rate_limit_exceeded',
  'timeout',
  'api_timeout',
  'server_error',
  'internal_error',
  'temporarily_overloaded',
  'overloaded'
]);

/** Responses API SSE 事件内瞬时错误的重试间隔 */
const RESPONSES_STREAM_RETRY_DELAYS_MS = [750, 2500, 6000];

/** 明确表示端点不支持 Responses API 的状态码 */
const RESPONSES_UNSUPPORTED_STATUSES = new Set([404, 405, 410, 415, 501]);

/** 400 响应中明确表示模型或端点不支持 Responses API 的错误语义 */
const RESPONSES_UNSUPPORTED_ERROR_PATTERN = /(?:unsupported|not supported|does not support|model_not_supported|unsupported_endpoint|unknown endpoint|invalid endpoint|not found)/i;

function getResponsesUrl(endpoint: ProviderEndpoint): string {
  return endpoint.responsesUrl || endpoint.apiUrl.replace(/\/chat\/completions$/, '/responses');
}

async function readErrorMessage(response: FetchResponse): Promise<string> {
  const errorText = await response.text();
  return errorText.slice(0, 2000);
}

async function postLLMStream(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<FetchResponse> {
  try {
    return await fetch(url, { method: 'POST', headers, body });
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    const causeMessage = cause instanceof Error
      ? `${cause.name}: ${cause.message}`
      : cause === undefined
        ? ''
        : String(cause);
    const requestError = error as Error;
    throw new Error(
      `LLM API 请求失败 (${url}): ${requestError.message}` +
      (causeMessage ? `; ${causeMessage}` : '')
    );
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postChatLLMStreamWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<FetchResponse> {
  for (let attempt = 0; attempt <= CHAT_RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await postLLMStream(url, headers, body);
    const delay = CHAT_RETRY_DELAYS_MS[attempt];
    if (response.ok || delay === undefined || !CHAT_TRANSIENT_RETRY_STATUSES.has(response.status)) {
      return response;
    }

    const errorMessage = await readErrorMessage(response);
    console.warn(
      `[LLM] Chat Completions transient error (${response.status}), retrying in ${delay}ms: ` +
      `${errorMessage.slice(0, 300) || '<empty response>'}`
    );
    await wait(delay);
  }

  throw new Error('LLM API 重试次数已耗尽');
}

async function postResponsesLLMStreamWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<FetchResponse> {
  for (let attempt = 0; attempt <= RESPONSES_RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await postLLMStream(url, headers, body);
    const delay = RESPONSES_RETRY_DELAYS_MS[attempt];
    if (
      response.ok ||
      delay === undefined ||
      !RESPONSES_TRANSIENT_RETRY_STATUSES.has(response.status)
    ) {
      return response;
    }

    const errorMessage = await readErrorMessage(response);
    console.warn(
      `[LLM] Responses API transient error (${response.status}), retrying in ${delay}ms: ` +
      `${errorMessage.slice(0, 300) || '<empty response>'}`
    );
    await wait(delay);
  }

  throw new Error('Responses API 重试次数已耗尽');
}

function shouldFallbackFromResponses(response: FetchResponse, errorMessage: string): boolean {
  if (RESPONSES_UNSUPPORTED_STATUSES.has(response.status)) return true;

  return response.status === 400 && RESPONSES_UNSUPPORTED_ERROR_PATTERN.test(errorMessage);
}

function getResponsesStreamFailure(event: Record<string, unknown>): ResponsesStreamFailure | null {
  if (event.type !== 'error' && event.type !== 'response.failed') return null;

  const response = event.response as Record<string, unknown> | undefined;
  const failure = (event.error ?? response?.error) as Record<string, unknown> | undefined;
  if (!failure && !event.message) return null;

  return {
    code: String(failure?.code || event.code || 'unknown'),
    message: String(failure?.message || event.message || JSON.stringify(event)).slice(0, 1000)
  };
}

function formatResponsesStreamFailure(failure: ResponsesStreamFailure): string {
  return `LLM API stream error (${failure.code}): ${failure.message}`;
}

async function pipeLLMStreamToClient(
  streamResult: LLMStreamResult,
  res: Response,
  canRetryTransientFailure: boolean
): Promise<boolean> {
  const { response, usesResponsesApi } = streamResult;
  if (!response.body) {
    throw new Error('LLM API 未返回流式响应体');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const responsesState: ResponsesStreamState = {
    functionCallStates: new Map(),
    emittedTextLength: 0,
    emittedReasoningLength: 0
  };
  let serverBuffer = '';
  let doneSent = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      serverBuffer += decoder.decode(value, { stream: true });
      const lines = serverBuffer.split('\n');
      serverBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          if (!doneSent) {
            res.write('data: [DONE]\n\n');
            doneSent = true;
          }
          continue;
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data) as Record<string, unknown>;
        } catch (error) {
          console.error('[SSE] Skipping malformed line:', (error as Error).message);
          continue;
        }

        if (usesResponsesApi) {
          const failure = getResponsesStreamFailure(parsed);
          if (failure) {
            if (
              canRetryTransientFailure &&
              !res.headersSent &&
              RESPONSES_STREAM_TRANSIENT_ERROR_CODES.has(failure.code)
            ) {
              await reader.cancel();
              return true;
            }
            throw new Error(formatResponsesStreamFailure(failure));
          }

          const converted = convertResponsesEvent(parsed, responsesState);
          if (converted) {
            res.write(converted);
          }
        } else {
          res.write(`data: ${JSON.stringify(parsed)}\n\n`);
        }
      }
    }

    if (!doneSent) {
      res.write('data: [DONE]\n\n');
    }
  } catch (error) {
    console.error('[SSE] Stream error:', error);
    const details = error instanceof Error ? error.message.slice(0, 2000) : String(error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'LLM 流式响应失败', details });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'LLM 流式响应失败', details })}\n\n`);
      if (!doneSent) res.write('data: [DONE]\n\n');
    }
  }

  res.end();
  return false;
}

async function fetchLLMStream(
  provider: LLMProvider,
  endpoint: ProviderEndpoint,
  cleanedMessages: Array<Record<string, unknown>>,
  messages: LLMChatMessage[],
  options: ChatStreamOptions
): Promise<LLMStreamResult> {
  const requestChatStream = async (): Promise<LLMStreamResult> => {
    const chatResponse = await postChatLLMStreamWithRetry(
      endpoint.apiUrl,
      buildHeaders(provider, endpoint.apiUrl, options.apiKey),
      JSON.stringify(buildChatPayload(
        provider,
        endpoint.modelName,
        cleanedMessages,
        options
      ))
    );

    if (!chatResponse.ok) {
      const chatError = await readErrorMessage(chatResponse);
      throw new Error(`LLM API error (${chatResponse.status}): ${chatError}`);
    }

    return { response: chatResponse, usesResponsesApi: false };
  };

  if (!endpoint.usesResponsesApi) {
    return requestChatStream();
  }

  const responsesUrl = getResponsesUrl(endpoint);
  const responsesResponse = await postResponsesLLMStreamWithRetry(
    responsesUrl,
    buildHeaders(provider, responsesUrl, options.apiKey),
    JSON.stringify(buildResponsesPayload(
      provider,
      endpoint.modelName,
      messages,
      options
    ))
  );

  if (responsesResponse.ok) {
    return { response: responsesResponse, usesResponsesApi: true };
  }

  const responsesError = await readErrorMessage(responsesResponse);
  if (RESPONSES_TRANSIENT_RETRY_STATUSES.has(responsesResponse.status)) {
    throw new Error(
      `LLM API error (${responsesResponse.status}) after Responses retries: ${responsesError}`
    );
  }

  if (!shouldFallbackFromResponses(responsesResponse, responsesError)) {
    throw new Error(`LLM API error (${responsesResponse.status}): ${responsesError}`);
  }

  console.warn(
    `[Responses API] ${PROVIDER_NAMES[provider]} ${endpoint.modelName} unavailable ` +
    `(${responsesResponse.status}), falling back to Chat Completions`
  );

  return requestChatStream();
}

/**
 * 发送 LLM 聊天请求（流式）
 * @param provider - 提供商名称
 * @param messages - 消息数组，每个消息包含 role 和 content 等字段
 * @param options - 选项对象
 * @param res - Express 响应对象（用于 SSE 流式响应）
 * @throws {Error} 当 API 密钥未提供或提供商无效时抛出错误
 */
export async function chatStream(
  provider: LLMProvider,
  messages: LLMChatMessage[],
  options: ChatStreamOptions,
  res: Response
): Promise<void> {
  if (!PROVIDER_NAMES[provider]) {
    throw new Error(`无效的提供商: ${provider}`);
  }

  if (!options.apiKey) {
    throw new Error(`请在设置中配置 ${PROVIDER_NAMES[provider]} API 密钥`);
  }

  const endpoint = resolveProviderEndpoint(
    provider,
    options.model || getDefaultModel(provider),
    options.cliproxyBaseUrl
  );
  const cleanedMessages = cleanMessages(messages);

  for (let attempt = 0; attempt <= RESPONSES_STREAM_RETRY_DELAYS_MS.length; attempt += 1) {
    const streamResult = await fetchLLMStream(
      provider,
      endpoint,
      cleanedMessages,
      messages,
      options
    );
    const canRetry = streamResult.usesResponsesApi && attempt < RESPONSES_STREAM_RETRY_DELAYS_MS.length;
    const shouldRetry = await pipeLLMStreamToClient(streamResult, res, canRetry);
    if (!shouldRetry) return;

    const delay = RESPONSES_STREAM_RETRY_DELAYS_MS[attempt];
    console.warn(
      `[Responses API] Stream transient error, retrying in ${delay}ms ` +
      `(attempt ${attempt + 1}/${RESPONSES_STREAM_RETRY_DELAYS_MS.length})`
    );
    await wait(delay);
  }

  throw new Error('Responses API 流内错误重试次数已耗尽');
}

function getDefaultModel(provider: LLMProvider): string {
  const defaults: Record<LLMProvider, string> = {
    deepseek: 'deepseek-v4-flash',
    openrouter: 'openai/gpt-3.5-turbo',
    zai: 'glm-5.3',
    opencode: 'opencode/big-pickle',
    cliproxy: 'cliproxy/'
  };

  return defaults[provider];
}

function getModelContextWindow(modelId: string): number | undefined {
  const normalizedModelId = modelId.replace(
    /^(?:opencode-go\/|opencode\/|cliproxy\/)/,
    ''
  );
  return MODEL_CONTEXT_WINDOWS[normalizedModelId];
}

async function fetchOpenCodeModels(
  url: string,
  prefix: string,
  chatModels: Set<string>,
  responsesModels: Set<string>,
  freeModels: Set<string>
): Promise<Model[]> {
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取 OpenCode 模型列表失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json() as OpenAIModelsResponse;
  const allowedModels = new Set([...chatModels, ...responsesModels]);

  return (data.data || [])
    .map(model => String(model.id || ''))
    .filter(modelId => allowedModels.has(modelId))
    .map(modelId => ({
      id: `${prefix}${modelId}`,
      name: OPENCODE_MODEL_NAMES[modelId] || modelId,
      provider: prefix === 'opencode-go/' ? 'OpenCode Go' : 'OpenCode Zen',
      price: freeModels.has(modelId) ? '免费' : '',
      contextWindow: getModelContextWindow(modelId)
    }));
}

function getZaiModelVersion(modelId: string): number | null {
  const match = /^glm-(\d+)(?:\.(\d+))?/.exec(modelId);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = match[2] ? Number(match[2]) : 0;
  return major * 100 + minor;
}

function isSupportedZaiModel(modelId: string): boolean {
  const version = getZaiModelVersion(modelId);
  return version !== null && version >= 502;
}

function compareZaiModels(a: string, b: string): number {
  const versionDifference = (getZaiModelVersion(b) ?? 0) - (getZaiModelVersion(a) ?? 0);
  if (versionDifference !== 0) return versionDifference;

  const isBaseModel = (id: string) => /^glm-\d+(?:\.\d+)?$/.test(id);
  if (isBaseModel(a) !== isBaseModel(b)) return isBaseModel(a) ? -1 : 1;

  return a.localeCompare(b);
}

function formatZaiModelName(modelId: string): string {
  return ZAI_MODEL_NAMES[modelId] || modelId.toUpperCase();
}

async function fetchZaiModels(apiKey: string): Promise<Model[]> {
  const modelsUrl = LLM_PROVIDERS.zai.modelsUrl!;
  const response = await fetch(modelsUrl, {
    headers: buildHeaders('zai', modelsUrl, apiKey)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取 Z.AI 模型列表失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json() as OpenAIModelsResponse;
  return (data.data || [])
    .map(model => String(model.id || ''))
    .filter(modelId => isSupportedZaiModel(modelId))
    .sort(compareZaiModels)
    .map(modelId => ({
      id: modelId,
      name: formatZaiModelName(modelId),
      provider: 'Z.AI',
      contextWindow: getModelContextWindow(modelId)
    }));
}

async function fetchDeepSeekModels(apiKey: string): Promise<Model[]> {
  const modelsUrl = LLM_PROVIDERS.deepseek.modelsUrl!;
  const response = await fetch(modelsUrl, {
    headers: buildHeaders('deepseek', modelsUrl, apiKey)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取 DeepSeek 模型列表失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json() as OpenAIModelsResponse;
  return (data.data || [])
    .map(model => String(model.id || ''))
    .filter(Boolean)
    .sort()
    .map(modelId => ({
      id: modelId,
      name: DEEPSEEK_MODEL_NAMES[modelId] || modelId,
      provider: 'DeepSeek',
      contextWindow: getModelContextWindow(modelId)
    }));
}

/**
 * 获取可用模型列表
 * @param provider - 提供商名称
 * @param apiKey - API 密钥
 * @param baseUrl - CLI Proxy API 基础地址
 * @returns 模型列表
 * @throws {Error} 当提供商无效或 API 密钥未提供时抛出错误
 */
export async function getModels(
  provider: LLMProvider,
  apiKey?: string,
  baseUrl?: string
): Promise<Model[]> {
  if (!PROVIDER_NAMES[provider]) {
    throw new Error('无效的提供商');
  }

  if ((provider === 'opencode' || provider === 'cliproxy') && !apiKey) {
    throw new Error(`请先配置 ${PROVIDER_NAMES[provider]} API 密钥`);
  }

  if (provider === 'deepseek') {
    if (!apiKey) {
      throw new Error('请先配置 DeepSeek API 密钥');
    }

    return fetchDeepSeekModels(apiKey);
  }

  if (provider === 'zai') {
    if (!apiKey) {
      throw new Error('请先配置 Z.AI API 密钥');
    }

    return fetchZaiModels(apiKey);
  }

  if (provider === 'opencode') {
    const results = await Promise.allSettled([
      fetchOpenCodeModels(
        LLM_PROVIDERS.opencode.modelsUrl!,
        'opencode/',
        OPENCODE_ZEN_CHAT_ONLY_MODELS,
        OPENCODE_ZEN_RESPONSES_MODELS,
        OPENCODE_ZEN_FREE_MODELS
      ),
      fetchOpenCodeModels(
        LLM_PROVIDERS.opencode.goModelsUrl!,
        'opencode-go/',
        OPENCODE_GO_CHAT_ONLY_MODELS,
        OPENCODE_GO_RESPONSES_MODELS,
        OPENCODE_GO_FREE_MODELS
      )
    ]);

    const models = results
      .filter((result): result is PromiseFulfilledResult<Model[]> => result.status === 'fulfilled')
      .flatMap(result => result.value);

    if (models.length === 0) {
      const reasons = results
        .filter(result => result.status === 'rejected')
        .map(result => String((result as PromiseRejectedResult).reason));
      throw new Error(reasons.join('; ') || '未获取到可用 OpenCode 模型');
    }

    return models;
  }

  if (provider === 'cliproxy') {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const response = await fetch(`${normalizedBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取 CLI Proxy API 模型列表失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json() as OpenAIModelsResponse;
    return (data.data || [])
      .map(model => String(model.id || ''))
      .filter(Boolean)
      .sort()
      .map(modelId => ({
        id: `cliproxy/${modelId}`,
        name: modelId,
        provider: 'CLI Proxy API',
        contextWindow: getModelContextWindow(modelId)
      }));
  }

  if (!apiKey) {
    throw new Error('API 密钥是必需的');
  }

  const response = await fetch(LLM_PROVIDERS.openrouter.modelsUrl!, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取 ${provider} 模型列表失败: ${errorText}`);
  }

  const data = await response.json() as OpenRouterModelsResponse;

  return data.data
    .filter(model => {
      const hasTextOutput = !model.output_modalities || model.output_modalities.includes('text');
      const hasPricing = model.pricing && (
        model.pricing.prompt !== undefined || model.pricing.completion !== undefined
      );
      const noRouter = !model.id.includes('router');
      return hasTextOutput && hasPricing && noRouter;
    })
    .map(model => {
      const pricing = model.pricing || {};
      const promptPrice = pricing.prompt ? parseFloat(pricing.prompt) : null;
      const completionPrice = pricing.completion ? parseFloat(pricing.completion) : null;

      let priceDisplay = '';
      if (promptPrice !== null && completionPrice !== null) {
        priceDisplay = promptPrice === 0 && completionPrice === 0
          ? '免费'
          : `$${promptPrice}/M`;
      }

      return {
        id: model.id,
        name: model.name || model.id,
        price: priceDisplay,
        contextWindow:
          typeof model.context_length === 'number' && model.context_length > 0
            ? model.context_length
            : undefined,
        pricing: {
          prompt: promptPrice,
          completion: completionPrice
        }
      };
    });
}
