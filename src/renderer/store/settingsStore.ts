import { create } from 'zustand';
import { settingsApi } from '../utils/api';

interface SettingsState {
  openaiApiKey: string;
  deepseekApiKey: string;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: { openaiApiKey?: string; deepseekApiKey?: string }) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  openaiApiKey: '',
  deepseekApiKey: '',
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const response = await settingsApi.get();
      const settings = response.data;
      set({
        openaiApiKey: settings.openai_api_key || '',
        deepseekApiKey: settings.deepseek_api_key || '',
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (settings) => {
    const currentSettings = {
      openai_api_key: settings.openaiApiKey || get().openaiApiKey,
      deepseek_api_key: settings.deepseekApiKey || get().deepseekApiKey,
    };
    
    const response = await settingsApi.update(currentSettings);
    const updated = response.data;
    
    set({
      openaiApiKey: updated.openai_api_key || '',
      deepseekApiKey: updated.deepseek_api_key || '',
    });
  },
}));
