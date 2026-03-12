import { create } from 'zustand';
import { settingsApi } from '../utils/api';

interface SettingsState {
  deepseekApiKey: string;
  openrouterApiKey: string;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: { deepseekApiKey?: string; openrouterApiKey?: string }) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  deepseekApiKey: '',
  openrouterApiKey: '',
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const response = await settingsApi.get();
      const settings = response.data;
      set({
        deepseekApiKey: settings.deepseek_api_key || '',
        openrouterApiKey: settings.openrouter_api_key || '',
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (settings) => {
    const currentSettings = {
      deepseek_api_key: settings.deepseekApiKey || get().deepseekApiKey,
      openrouter_api_key: settings.openrouterApiKey || get().openrouterApiKey,
    };
    
    const response = await settingsApi.update(currentSettings);
    const updated = response.data;
    
    set({
      deepseekApiKey: updated.deepseek_api_key || '',
      openrouterApiKey: updated.openrouter_api_key || '',
    });
  },
}));
