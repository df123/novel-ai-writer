export interface Message {
  id: string;
  chatId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
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

export interface TimelineNodeVersion {
  id: string;
  timelineNodeId: string;
  title: string;
  content: string;
  version: number;
  createdAt: number;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  avatar?: string;
  personality?: string;
  background?: string;
  relationships?: string;
  createdAt: number;
}

export interface CharacterVersion {
  id: string;
  characterId: string;
  name: string;
  description?: string;
  personality?: string;
  background?: string;
  avatar?: string;
  version: number;
  createdAt: number;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}
