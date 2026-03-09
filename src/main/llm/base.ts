import { LLMProvider, Message, ChatOptions, StreamResponse, ModelInfo } from '@shared/types';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract name: string;
  protected apiKey: string = '';

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  abstract chat(messages: Omit<Message, 'id' | 'chatId' | 'timestamp' | 'orderIndex' | 'deleted' | 'deletedAt'>[], options: ChatOptions): Promise<StreamResponse>;

  abstract getModels(): Promise<ModelInfo[]>;

  abstract validateApiKey(apiKey: string): Promise<boolean>;

  protected async *createStreamResponse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

        for (const line of lines) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.choices?.[0]?.delta?.content) {
              yield data.choices[0].delta.content;
            }
          } catch (e) {
            console.warn('Failed to parse stream chunk:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  protected buildMessagesArray(messages: Omit<Message, 'id' | 'chatId' | 'timestamp' | 'orderIndex' | 'deleted' | 'deletedAt'>[]): Array<{ role: string; content: string }> {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }
}
