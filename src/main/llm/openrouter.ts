import { BaseLLMProvider } from './base';
import { ChatOptions, ModelInfo, Message, StreamResponse } from '@shared/types';

export class OpenRouterProvider extends BaseLLMProvider {
  name = 'OpenRouter';
  private baseUrl = 'https://openrouter.ai/api/v1';

  async chat(
    messages: Omit<Message, 'id' | 'chatId' | 'timestamp' | 'orderIndex' | 'deleted' | 'deletedAt'>[],
    options: ChatOptions
  ): Promise<StreamResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://novelai-writer.local',
        'X-OpenRouter-Title': 'NovelAI Writer',
      },
      body: JSON.stringify({
        model: options.model,
        messages: this.buildMessagesArray(messages),
        temperature: options.temperature ?? 0.7,
        top_p: options.topP,
        max_tokens: options.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    return this.createStreamResponse(response.body);
  }

  async getModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json() as { data: any[] };
    
    const chatModels = data.data
      .filter((m: any) => m.id.includes('chat') || m.id.includes('claude') || m.id.includes('gpt') || m.id.includes('deepseek'))
      .map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length || 4096,
      }));

    return chatModels;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
