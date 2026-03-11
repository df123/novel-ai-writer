import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '../utils/api';

export const useSettingsStore = defineStore('settings', () => {
  const openaiApiKey = ref('');
  const deepseekApiKey = ref('');
  const openrouterApiKey = ref('');
  const temperature = ref(0.7);
  const selectedProvider = ref('deepseek');
  const isLoading = ref(false);

  const loadSettings = async () => {
    isLoading.value = true;
    try {
      const response = await settingsApi.get();
      const settings = response.data;
      openaiApiKey.value = settings.openai_api_key || '';
      deepseekApiKey.value = settings.deepseek_api_key || '';
      openrouterApiKey.value = settings.openrouter_api_key || '';
      temperature.value = settings.temperature ? parseFloat(settings.temperature) : 0.7;
      selectedProvider.value = settings.selected_provider || 'deepseek';
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const updateSettings = async (settings: { openaiApiKey?: string; deepseekApiKey?: string; openrouterApiKey?: string; temperature?: number; selectedProvider?: string }) => {
    const currentSettings: Record<string, string | number> = {
      openai_api_key: settings.openaiApiKey || openaiApiKey.value,
      deepseek_api_key: settings.deepseekApiKey || deepseekApiKey.value,
      openrouter_api_key: settings.openrouterApiKey || openrouterApiKey.value,
    };
    
    if (settings.temperature !== undefined) {
      currentSettings.temperature = settings.temperature;
    }
    
    if (settings.selectedProvider !== undefined) {
      currentSettings.selected_provider = settings.selectedProvider;
    }
    
    const response = await settingsApi.update(currentSettings);
    const updated = response.data;
    
    openaiApiKey.value = updated.openai_api_key || '';
    deepseekApiKey.value = updated.deepseek_api_key || '';
    openrouterApiKey.value = updated.openrouter_api_key || '';
    temperature.value = updated.temperature ? parseFloat(updated.temperature) : 0.7;
    selectedProvider.value = updated.selected_provider || 'deepseek';
  };

  return {
    openaiApiKey,
    deepseekApiKey,
    openrouterApiKey,
    temperature,
    selectedProvider,
    isLoading,
    loadSettings,
    updateSettings,
  };
});
