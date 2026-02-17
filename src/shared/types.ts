export interface Message {
  id: string;
  chatId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  deleted?: boolean;
  deletedAt?: number;
  orderIndex: number;
}

export interface Chat {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface TimelineNode {
  id: string;
  projectId: string;
  title: string;
  date: string;
  description: string;
  orderIndex: number;
  createdAt: number;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  avatar?: string;
  personality?: string;
  background?: string;
  relationships?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: VariableDefinition[];
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VariableDefinition {
  name: string;
  type: 'text' | 'timeline' | 'character' | 'date';
  defaultValue?: string;
  required: boolean;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
}

export interface StreamResponse {
  [Symbol.asyncIterator](): AsyncIterator<string>;
}

export interface LLMProvider {
  name: string;
  chat(messages: Omit<Message, 'id' | 'chatId' | 'timestamp' | 'orderIndex' | 'deleted' | 'deletedAt'>[], options: ChatOptions): Promise<StreamResponse>;
  getModels(): Promise<ModelInfo[]>;
  validateApiKey(apiKey: string): Promise<boolean>;
}

export interface ProjectExport {
  project: Project;
  timelineNodes: TimelineNode[];
  characters: Character[];
  chats: Chat[];
  messages: Message[];
}

export interface TemplateContext {
  timelineTitle?: string;
  timelineDate?: string;
  timelineDescription?: string;
  characters?: Character[];
}
