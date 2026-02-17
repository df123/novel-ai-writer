import { IPC_CHANNELS } from '../../shared/constants';

class IPCClient {
  invoke(channel: string, ...args: any[]): Promise<any> {
    return window.electron.ipc.invoke(channel, ...args);
  }

  on(channel: string, callback: (...args: any[]) => void): void {
    window.electron.ipc.on(channel, callback);
  }

  off(channel: string, callback: (...args: any[]) => void): void {
    window.electron.ipc.off(channel, callback);
  }

  project = {
    create: (title: string, description?: string) =>
      this.invoke(IPC_CHANNELS.PROJECT.CREATE, { title, description }),
    get: (id: string) => this.invoke(IPC_CHANNELS.PROJECT.GET, id),
    getAll: () => this.invoke(IPC_CHANNELS.PROJECT.GET_ALL),
    update: (id: string, updates: any) =>
      this.invoke(IPC_CHANNELS.PROJECT.UPDATE, id, updates),
    delete: (id: string) => this.invoke(IPC_CHANNELS.PROJECT.DELETE, id),
  };

  chat = {
    create: (projectId: string, title: string) =>
      this.invoke(IPC_CHANNELS.CHAT.CREATE, { projectId, title }),
    getAll: (projectId: string) => this.invoke(IPC_CHANNELS.CHAT.GET_ALL, projectId),
    getMessages: (chatId: string) => this.invoke(IPC_CHANNELS.CHAT.GET_MESSAGES, chatId),
    sendMessage: (data: any) => this.invoke(IPC_CHANNELS.CHAT.SEND_MESSAGE, data),
    deleteMessage: (messageId: string) =>
      this.invoke(IPC_CHANNELS.CHAT.DELETE_MESSAGE, messageId),
    clearHistory: (chatId: string) => this.invoke(IPC_CHANNELS.CHAT.CLEAR_HISTORY, chatId),
  };

  timeline = {
    create: (projectId: string, node: any) =>
      this.invoke(IPC_CHANNELS.TIMELINE.CREATE, projectId, node),
    getAll: (projectId: string) => this.invoke(IPC_CHANNELS.TIMELINE.GET_ALL, projectId),
    update: (id: string, updates: any) =>
      this.invoke(IPC_CHANNELS.TIMELINE.UPDATE, id, updates),
    delete: (id: string) => this.invoke(IPC_CHANNELS.TIMELINE.DELETE, id),
  };

  character = {
    create: (projectId: string, character: any) =>
      this.invoke(IPC_CHANNELS.CHARACTER.CREATE, projectId, character),
    getAll: (projectId: string) => this.invoke(IPC_CHANNELS.CHARACTER.GET_ALL, projectId),
    update: (id: string, updates: any) =>
      this.invoke(IPC_CHANNELS.CHARACTER.UPDATE, id, updates),
    delete: (id: string) => this.invoke(IPC_CHANNELS.CHARACTER.DELETE, id),
  };

  export = {
    save: (projectId: string, format: 'txt' | 'md') =>
      this.invoke(IPC_CHANNELS.EXPORT.SAVE, { projectId, format }),
  };

  settings = {
    get: (key: string) => this.invoke(IPC_CHANNELS.SETTINGS.GET, key),
    set: (key: string, value: string) => this.invoke(IPC_CHANNELS.SETTINGS.SET, key, value),
  };
}

export const ipcClient = new IPCClient();
