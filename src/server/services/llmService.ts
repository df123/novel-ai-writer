// LLM API 调用服务
import { LLM_PROVIDERS } from '../config';
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
}

/**
 * LLM 提供商类型
 */
type LLMProvider = 'deepseek' | 'openrouter';

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
}

/**
 * OpenRouter 模型列表响应接口
 */
interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

/**
 * 发送 LLM 聊天请求（流式）
 * @param provider - 提供商名称（deepseek 或 openrouter）
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
  const apiKey = options.apiKey;

  if (!apiKey) {
    const providerNames: Record<LLMProvider, string> = {
      deepseek: 'DeepSeek',
      openrouter: 'OpenRouter'
    };
    throw new Error(`请在设置中配置 ${providerNames[provider] || provider} API 密钥`);
  }

  let apiUrl: string;
  let modelName: string;
  
  if (provider === 'deepseek') {
    apiUrl = LLM_PROVIDERS.deepseek.apiUrl;
    modelName = options.model || 'deepseek-reasoner';
  } else if (provider === 'openrouter') {
    apiUrl = LLM_PROVIDERS.openrouter.apiUrl!;
    modelName = options.model || 'openai/gpt-3.5-turbo';
  } else {
    throw new Error(`无效的提供商: ${provider}`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://novelai-writer.local';
    headers['X-OpenRouter-Title'] = 'NovelAI Writer';
  }

  const cleanedMessages = messages.map(msg => {
    const cleaned: Record<string, unknown> = { role: msg.role };
    if (msg.content !== undefined) cleaned.content = msg.content;
    if (msg.tool_calls) cleaned.tool_calls = msg.tool_calls;
    if (msg.tool_call_id) cleaned.tool_call_id = msg.tool_call_id;
    if (msg.reasoning_content !== undefined) cleaned.reasoning_content = msg.reasoning_content;
    return cleaned;
  });

  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages: cleanedMessages,
    stream: true,
    temperature: options.temperature,
    top_p: options.topP,
    max_tokens: options.maxTokens
  };

  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }

  if (options.thinking && provider === 'deepseek') {
    requestBody.thinking = options.thinking;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  // 设置 SSE 响应
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let serverBuffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      serverBuffer += decoder.decode(value, { stream: true });
      const lines = serverBuffer.split('\n');
      serverBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            break;
          }

          try {
            const parsed = JSON.parse(data);
            res.write(`data: ${JSON.stringify(parsed)}\n\n`);
          } catch (e) {
            console.error('[SSE] Skipping malformed line:', (e as Error).message);
          }
        }
      }
    }
  } catch (error) {
    console.error('[SSE] Stream error:', error);
    // 确保响应被正确关闭
    if (!res.headersSent) {
      res.status(500).json({ error: '流传输中断' });
    }
  } finally {
    res.end();
  }
}

/**
 * 获取可用模型列表
 * @param provider - 提供商名称（deepseek 或 openrouter）
 * @param apiKey - API 密钥（openrouter 需要）
 * @returns 模型列表，每个模型包含 id、name、price 和 pricing 字段
 * @throws {Error} 当提供商无效或 API 密钥未提供时抛出错误
 */
export async function getModels(provider: LLMProvider, apiKey?: string): Promise<Model[]> {
  let models: Model[] = [];

  if (provider === 'deepseek') {
    models = LLM_PROVIDERS.deepseek.models!.map(m => ({
      id: m.id,
      name: m.name
    }));
  } else if (provider === 'openrouter') {
    if (!apiKey) {
      throw new Error('API 密钥是必需的');
    }

    const response = await fetch(LLM_PROVIDERS.openrouter.modelsUrl!, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取 ${provider} 模型列表失败: ${errorText}`);
    }

    const data = await response.json() as OpenRouterModelsResponse;

    models = data.data
      .filter(m => {
        const hasTextOutput = !m.output_modalities || m.output_modalities.includes('text');
        const hasPricing = m.pricing && (m.pricing.prompt !== undefined || m.pricing.completion !== undefined);
        const noRouter = !m.id.includes('router');

        return hasTextOutput && hasPricing && noRouter;
      })
      .map(m => {
        const pricing = m.pricing || {};
        const promptPrice = pricing.prompt ? parseFloat(pricing.prompt) : null;
        const completionPrice = pricing.completion ? parseFloat(pricing.completion) : null;

        let priceDisplay = '';
        if (promptPrice !== null && completionPrice !== null) {
          if (promptPrice === 0 && completionPrice === 0) {
            priceDisplay = '免费';
          } else {
            priceDisplay = `$${promptPrice}/M`;
          }
        }

        return {
          id: m.id,
          name: m.name || m.id,
          price: priceDisplay,
          pricing: {
            prompt: promptPrice,
            completion: completionPrice
          }
        };
      });
  } else {
    throw new Error('无效的提供商');
  }

  return models;
}
