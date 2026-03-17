import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Projects
export const projectApi = {
  list: () => api.get('/projects'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: { title: string; description?: string }) => api.post('/projects', data),
  update: (id: string, data: { title: string; description?: string }) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  export: (id: string, format: 'md' | 'txt') => api.post(`/projects/${id}/export`, { format }),
};

// Chats
export const chatApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/chats`),
  get: (id: string) => api.get(`/chats/${id}`),
  create: (projectId: string, data: { name: string }) => api.post(`/projects/${projectId}/chats`, data),
  update: (id: string, data: { name: string }) => api.put(`/chats/${id}`, data),
  delete: (id: string) => api.delete(`/chats/${id}`),
};

// Messages
export const messageApi = {
  list: (chatId: string) => api.get(`/chats/${chatId}/messages`),
  create: (chatId: string, data: { role: string; content: string; reasoning_content?: string; tool_calls?: any[] }) => api.post(`/chats/${chatId}/messages`, data),
  update: (id: string, data: { role: string; content: string; reasoning_content?: string; tool_calls?: any[] }) => api.put(`/messages/${id}`, data),
  delete: (id: string) => api.delete(`/messages/${id}`),
};

// Timeline
export const timelineApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/timeline`),
  create: (projectId: string, data: { title: string; content?: string; orderIndex?: number }) =>
    api.post(`/projects/${projectId}/timeline`, data),
  update: (id: string, data: { title: string; content?: string; orderIndex?: number; createVersion?: boolean }) =>
    api.put(`/timeline/${id}`, data),
  delete: (id: string) => api.delete(`/timeline/${id}`),
  getVersions: (nodeId: string) => api.get(`/timeline/${nodeId}/versions`),
  restoreVersion: (nodeId: string, versionId: string) => api.post(`/timeline/${nodeId}/versions/${versionId}/restore`),
};

// Characters
export const characterApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/characters`),
  create: (
    projectId: string,
    data: {
      name: string;
      description?: string;
      personality?: string;
      background?: string;
      avatar?: string;
    },
  ) => api.post(`/projects/${projectId}/characters`, data),
  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      personality?: string;
      background?: string;
      avatar?: string;
      createVersion?: boolean;
    },
  ) => api.put(`/characters/${id}`, data),
  delete: (id: string) => api.delete(`/characters/${id}`),
  getVersions: (characterId: string) => api.get(`/characters/${characterId}/versions`),
  restoreVersion: (characterId: string, versionId: string) => api.post(`/characters/${characterId}/versions/${versionId}/restore`),
};

// LLM
export const llmApi = {
  chat: (provider: string, messages: any[], options?: { model?: string; temperature?: number; apiKey?: string; tools?: any[]; thinking?: { type: string } }) => {
    return fetch(`${API_BASE_URL}/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider, messages, options }),
    });
  },
};

// Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (settings: Record<string, string | number>) => api.put('/settings', settings),
};

// Models
export const modelsApi = {
  list: (provider: string, apiKey: string) => 
    api.post(`/models/${provider}`, { apiKey }),
};

// Prompts
export const promptApi = {
  list: () => api.get('/prompts'),
  create: (data: { name: string; template: string; type: string }) => api.post('/prompts', data),
  delete: (id: string) => api.delete(`/prompts/${id}`),
};

export default api;
