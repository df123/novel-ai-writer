import { BaseLLMProvider } from './base';
import { ChatOptions, ModelInfo, Message } from '../../shared/types';

export class DeepSeekProvider extends BaseLLMProvider {
  name = 'DeepSeek';
  private baseUrl = 'https://api.deepseek.com/v1';

  async chat(
    messages: Omit<Message, 'id' | 'chatId' | 'timestamp' | 'orderIndex' | 'deleted' | 'deletedAt'>[],
    options: ChatOptions
  ): Promise<AsyncGenerator<string>> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
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
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
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

    const data = await response.json();
    
    const models = data.data.map((m: any) => ({
      id: m.id,
      name: m.id,
      contextLength: 16384,
    }));

    return models;
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
