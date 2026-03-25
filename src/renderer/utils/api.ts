import axios from 'axios';
import type { TableInfo, TableDataResponse, QueryResponse, CreateThemeRequest, UpdateThemeRequest } from '@shared/types';

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
  create: (chatId: string, data: { role: string; content: string; reasoning_content?: string; tool_calls?: any[]; tool_call_id?: string }) => api.post(`/chats/${chatId}/messages`, data),
  update: (id: string, data: { role: string; content: string; reasoning_content?: string; tool_calls?: any[]; tool_call_id?: string }) => api.put(`/messages/${id}`, data),
  delete: (id: string) => api.delete(`/messages/${id}`),
  batchDelete: (ids: string[]) => api.post('/messages/batch-delete', { ids }),
};

// Timeline
export const timelineApi = {
  list: (projectId: string, filters?: { title?: string; content?: string }) => {
    const params = new URLSearchParams();
    if (filters?.title) params.append('title', filters.title);
    if (filters?.content) params.append('content', filters.content);
    const queryString = params.toString();
    const url = `/projects/${projectId}/timeline${queryString ? `?${queryString}` : ''}`;
    return api.get(url);
  },
  get: (id: string) => api.get(`/timeline/${id}`),
  create: (projectId: string, data: { title: string; date?: string; content?: string; orderIndex?: number }) =>
    api.post(`/projects/${projectId}/timeline`, data),
  update: (id: string, data: { title?: string; date?: string; content?: string; orderIndex?: number; createVersion?: boolean }) =>
    api.put(`/timeline/${id}`, data),
  delete: (id: string) => api.delete(`/timeline/${id}`),
  getVersions: (nodeId: string) => api.get(`/timeline/${nodeId}/versions`),
  restoreVersion: (nodeId: string, versionId: string) => api.post(`/timeline/${nodeId}/versions/${versionId}/restore`),
  restore: (id: string) => api.post(`/timeline/${id}/restore`),
  permanentDelete: (id: string) => api.delete(`/timeline/${id}/permanent`),
  getTrash: (projectId: string) => api.get(`/projects/${projectId}/timeline/trash`),
};

// Characters
export const characterApi = {
  list: (projectId: string, filters?: { name?: string; personality?: string; background?: string }) => {
    const params = new URLSearchParams();
    if (filters?.name) params.append('name', filters.name);
    if (filters?.personality) params.append('personality', filters.personality);
    if (filters?.background) params.append('background', filters.background);
    const queryString = params.toString();
    const url = `/projects/${projectId}/characters${queryString ? `?${queryString}` : ''}`;
    return api.get(url);
  },
  get: (id: string) => api.get(`/characters/${id}`),
  create: (
    projectId: string,
    data: {
      name: string;
      personality?: string;
      background?: string;
      relationships?: string;
    },
  ) => api.post(`/projects/${projectId}/characters`, data),
  update: (
    id: string,
    data: {
      name?: string;
      personality?: string;
      background?: string;
      relationships?: string;
      createVersion?: boolean;
    },
  ) => api.put(`/characters/${id}`, data),
  delete: (id: string) => api.delete(`/characters/${id}`),
  getVersions: (characterId: string) => api.get(`/characters/${characterId}/versions`),
  restoreVersion: (characterId: string, versionId: string) => api.post(`/characters/${characterId}/versions/${versionId}/restore`),
  restore: (id: string) => api.post(`/characters/${id}/restore`),
  permanentDelete: (id: string) => api.delete(`/characters/${id}/permanent`),
  getTrash: (projectId: string) => api.get(`/projects/${projectId}/characters/trash`),
};

// LLM
export const llmApi = {
  chat: (
    provider: string,
    messages: any[],
    options?: { model?: string; temperature?: number; apiKey?: string; tools?: any[]; thinking?: { type: string } },
    signal?: AbortSignal
  ) => {
    return fetch(`${API_BASE_URL}/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider, messages, options }),
      signal,
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
    api.post(`/llm/models/${provider}`, { apiKey }),
};

// Prompts
export const promptApi = {
  list: () => api.get('/prompts'),
  create: (data: { name: string; template: string; type: string }) => api.post('/prompts', data),
  delete: (id: string) => api.delete(`/prompts/${id}`),
};

// 章节管理 API
export const chapterApi = {
  // 获取章节列表
  list: (projectId: string) => 
    api.get(`/projects/${projectId}/chapters`),
  
  // 获取单个章节
  get: (projectId: string, chapterId: string) => 
    api.get(`/projects/${projectId}/chapters/${chapterId}`),
  
  // 创建章节
  create: (projectId: string, data: { chapterNumber: number; title: string; content: string; sourceMessageId?: string }) => 
    api.post(`/projects/${projectId}/chapters`, data),
  
  // 更新章节
  update: (projectId: string, chapterId: string, data: { title?: string; chapterNumber?: number }) => 
    api.put(`/projects/${projectId}/chapters/${chapterId}`, data),
  
  // 软删除章节
  delete: (projectId: string, chapterId: string) => 
    api.delete(`/projects/${projectId}/chapters/${chapterId}`),
  
  // 恢复章节
  restore: (projectId: string, chapterId: string) => 
    api.put(`/projects/${projectId}/chapters/${chapterId}/restore`),
  
  // 永久删除章节
  permanentDelete: (projectId: string, chapterId: string) => 
    api.delete(`/projects/${projectId}/chapters/${chapterId}/permanent`),
  
  // 批量更新排序
  updateOrder: (projectId: string, data: { chapters: Array<{ id: string; chapterNumber: number }> }) => 
    api.put(`/projects/${projectId}/chapters/order`, data),
  
  // 导出章节
  export: (projectId: string, format: 'txt' | 'md' = 'txt') => 
    api.get(`/projects/${projectId}/chapters/export`, { 
      params: { format },
      responseType: 'blob'
    }),
  
  // 获取回收站章节
  getTrash: (projectId: string) => 
    api.get(`/projects/${projectId}/chapters/trash`),
  
  // 清空回收站
  emptyTrash: (projectId: string) => 
    api.delete(`/projects/${projectId}/chapters/trash/empty`)
};

// 数据库管理 API
export const dbApi = {
  // 获取所有表信息
  getTables: () => api.get<{ tables: TableInfo[] }>('/db/tables'),
  
  // 查询表数据
  getTableData: (
    tableName: string,
    options?: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      order?: 'ASC' | 'DESC';
    }
  ) => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.orderBy) params.append('orderBy', options.orderBy);
    if (options?.order) params.append('order', options.order);
    const queryString = params.toString();
    const url = `/db/tables/${tableName}${queryString ? `?${queryString}` : ''}`;
    return api.get<TableDataResponse>(url);
  },
  
  // 执行自定义查询
  executeQuery: (sql: string, params?: any[]) => 
    api.post<QueryResponse>('/db/query', { sql, params }),
  
  // 插入数据
  insert: (tableName: string, data: Record<string, any>) => 
    api.post(`/db/tables/${tableName}`, data),
  
  // 更新数据
  update: (tableName: string, id: string, data: Record<string, any>) => 
    api.put(`/db/tables/${tableName}/${id}`, data),
  
  // 删除数据
  delete: (tableName: string, id: string) => 
    api.delete(`/db/tables/${tableName}/${id}`),
};

// 主旨管理 API
export const themeApi = {
  // 获取项目的主旨（每个项目只有一个主旨）
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/themes`),
  
  // 创建或更新项目主旨
  create: (projectId: string, data: CreateThemeRequest) =>
    api.post(`/projects/${projectId}/themes`, data),
  
  // 获取单个主旨
  get: (id: string) =>
    api.get(`/themes/${id}`),
  
  // 更新主旨
  update: (id: string, data: UpdateThemeRequest) =>
    api.put(`/themes/${id}`, data),
  
  // 删除主旨
  delete: (id: string) =>
    api.delete(`/themes/${id}`),
  
  // 获取主旨的历史记录
  getHistory: (id: string) =>
    api.get(`/themes/${id}/history`),
  
  // 获取指定版本的历史记录
  getHistoryVersion: (id: string, version: number) =>
    api.get(`/themes/${id}/history/${version}`),
};

export default api;
