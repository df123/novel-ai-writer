import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '../utils/api';

export const useSettingsStore = defineStore('settings', () => {
  const openaiApiKey = ref('');
  const deepseekApiKey = ref('');
  const isLoading = ref(false);

  const loadSettings = async () => {
    isLoading.value = true;
    try {
      const response = await settingsApi.get();
      const settings = response.data;
      openaiApiKey.value = settings.openai_api_key || '';
      deepseekApiKey.value = settings.deepseek_api_key || '';
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const updateSettings = async (settings: { openaiApiKey?: string; deepseekApiKey?: string }) => {
    const currentSettings = {
      openai_api_key: settings.openaiApiKey || openaiApiKey.value,
      deepseek_api_key: settings.deepseekApiKey || deepseekApiKey.value,
    };
    
    const response = await settingsApi.update(currentSettings);
    const updated = response.data;
    
    openaiApiKey.value = updated.openai_api_key || '';
    deepseekApiKey.value = updated.deepseek_api_key || '';
  };

  return {
    openaiApiKey,
    deepseekApiKey,
    isLoading,
    loadSettings,
    updateSettings,
  };
});
