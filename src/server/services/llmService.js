// LLM API 调用服务
const { LLM_PROVIDERS } = require('../config');

/**
 * 发送 LLM 聊天请求（流式）
 * @param {string} provider - 提供商名称（deepseek 或 openrouter）
 * @param {Array<Object>} messages - 消息数组，每个消息包含 role 和 content 等字段
 * @param {Object} options - 选项对象
 * @param {string} options.apiKey - API 密钥
 * @param {string} options.model - 模型名称
 * @param {number} options.temperature - 温度参数
 * @param {number} options.topP - top_p 参数
 * @param {number} options.maxTokens - 最大 token 数
 * @param {Array<Object>} options.tools - 工具定义数组
 * @param {Object} options.thinking - 思考参数（deepseek 专用）
 * @param {Object} res - Express 响应对象（用于 SSE 流式响应）
 * @throws {Error} 当 API 密钥未提供或提供商无效时抛出错误
 */
async function chatStream(provider, messages, options, res) {
  const apiKey = options.apiKey;

  if (!apiKey) {
    const providerNames = {
      deepseek: 'DeepSeek',
      openrouter: 'OpenRouter'
    };
    throw new Error(`请在设置中配置 ${providerNames[provider] || provider} API 密钥`);
  }

  let apiUrl, modelName;
  if (provider === 'deepseek') {
    apiUrl = LLM_PROVIDERS.deepseek.apiUrl;
    modelName = options.model || 'deepseek-reasoner';
  } else if (provider === 'openrouter') {
    apiUrl = LLM_PROVIDERS.openrouter.apiUrl;
    modelName = options.model || 'openai/gpt-3.5-turbo';
  } else {
    throw new Error(`无效的提供商: ${provider}`);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://novelai-writer.local';
    headers['X-OpenRouter-Title'] = 'NovelAI Writer';
  }

  const cleanedMessages = messages.map(msg => {
    const cleaned = { role: msg.role };
    if (msg.content !== undefined) cleaned.content = msg.content;
    if (msg.tool_calls) cleaned.tool_calls = msg.tool_calls;
    if (msg.tool_call_id) cleaned.tool_call_id = msg.tool_call_id;
    if (msg.reasoning_content !== undefined) cleaned.reasoning_content = msg.reasoning_content;
    return cleaned;
  });

  const requestBody = {
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

  const reader = response.body.getReader();
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
            console.error('[SSE] Skipping malformed line:', e.message);
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
 * @param {string} provider - 提供商名称（deepseek 或 openrouter）
 * @param {string} apiKey - API 密钥（openrouter 需要）
 * @returns {Array<Object>} 模型列表，每个模型包含 id、name、price 和 pricing 字段
 * @throws {Error} 当提供商无效或 API 密钥未提供时抛出错误
 */
async function getModels(provider, apiKey) {
  let models = [];

  if (provider === 'deepseek') {
    models = LLM_PROVIDERS.deepseek.models;
  } else if (provider === 'openrouter') {
    if (!apiKey) {
      throw new Error('API 密钥是必需的');
    }

    const response = await fetch(LLM_PROVIDERS.openrouter.modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取 ${provider} 模型列表失败: ${errorText}`);
    }

    const data = await response.json();

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

module.exports = {
  chatStream,
  getModels
};
