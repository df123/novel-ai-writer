import { OpenAIProvider } from './openai';
import { DeepSeekProvider } from './deepseek';
import { LLMProvider, ChatOptions, Message } from '../../shared/types';
import { getDatabase } from '../database';
import * as crypto from 'crypto-js';
import * as os from 'os';
import { app } from 'electron';

class LLMService {
  private providers: Map<string, LLMProvider>;
  private secretKey: string;

  constructor() {
    this.providers = new Map();
    const machineId = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    this.secretKey = crypto.SHA256(machineId + 'novel-ai-salt').toString();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('deepseek', new DeepSeekProvider());
  }

  private loadApiKey(providerName: string): string | null {
    const db = getDatabase();
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(`apiKey.${providerName}`) as { value: string } | undefined;
    
    if (!result) return null;

    try {
      const decrypted = crypto.AES.decrypt(result.value, this.secretKey);
      return decrypted.toString(crypto.enc.Utf8);
    } catch {
      return null;
    }
  }

  private saveApiKey(providerName: string, apiKey: string): void {
    const db = getDatabase();
    const encrypted = crypto.AES.encrypt(apiKey, this.secretKey).toString();
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `).run(`apiKey.${providerName}`, encrypted);
  }

  async setApiKey(providerName: string, apiKey: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const isValid = await provider.validateApiKey(apiKey);
    if (!isValid) {
      throw new Error('Invalid API key');
    }

    provider.setApiKey(apiKey);
    this.saveApiKey(providerName, apiKey);
  }

  getProvider(providerName: string): LLMProvider | null {
    const provider = this.providers.get(providerName);
    if (!provider) return null;

    const apiKey = this.loadApiKey(providerName);
    if (!apiKey) return null;

    provider.setApiKey(apiKey);
    return provider;
  }

  async chat(
    providerName: string,
    messages: Omit<Message, 'id' | 'chatId' | 'timestamp' | 'orderIndex' | 'deleted' | 'deletedAt'>[],
    options: ChatOptions
  ): Promise<AsyncGenerator<string>> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not configured`);
    }

    return provider.chat(messages, options);
  }

  async getModels(providerName: string): Promise<any[]> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not configured`);
    }

    return provider.getModels();
  }

  async validateApiKey(providerName: string, apiKey: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) return false;

    return provider.validateApiKey(apiKey);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const llmService = new LLMService();
