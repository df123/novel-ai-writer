import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '../utils/api';

export const useSettingsStore = defineStore('settings', () => {
  const deepseekApiKey = ref('');
  const openrouterApiKey = ref('');
  const temperature = ref(0.7);
  const selectedProvider = ref('deepseek');
  const selectedModel = ref('deepseek-reasoner');
  const models = ref<Array<{ id: string; name: string; price?: string; pricing?: { prompt: number | null; completion: number | null } }>>([]);
  const isLoading = ref(false);
  const isLoadingModels = ref(false);

  const loadSettings = async () => {
    isLoading.value = true;
    try {
      const response = await settingsApi.get();
      const settings = response.data;
      deepseekApiKey.value = settings.deepseek_api_key || '';
      openrouterApiKey.value = settings.openrouter_api_key || '';
      temperature.value = settings.temperature ? parseFloat(settings.temperature) : 0.7;
      selectedProvider.value = settings.selected_provider || 'deepseek';
      selectedModel.value = settings.selected_model || 'deepseek-reasoner';
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const updateSettings = async (settings: { deepseekApiKey?: string; openrouterApiKey?: string; temperature?: number; selectedProvider?: string; selectedModel?: string }) => {
    const currentSettings: Record<string, string | number> = {
      deepseek_api_key: settings.deepseekApiKey || deepseekApiKey.value,
      openrouter_api_key: settings.openrouterApiKey || openrouterApiKey.value,
    };
    
    if (settings.temperature !== undefined) {
      currentSettings.temperature = settings.temperature;
    }
    
    if (settings.selectedProvider !== undefined) {
      currentSettings.selected_provider = settings.selectedProvider;
    }
    
    if (settings.selectedModel !== undefined) {
      currentSettings.selected_model = settings.selectedModel;
    }
    
    const response = await settingsApi.update(currentSettings);
    const updated = response.data;
    
    deepseekApiKey.value = updated.deepseek_api_key || '';
    openrouterApiKey.value = updated.openrouter_api_key || '';
    temperature.value = updated.temperature ? parseFloat(updated.temperature) : 0.7;
    selectedProvider.value = updated.selected_provider || 'deepseek';
    selectedModel.value = updated.selected_model || 'deepseek-reasoner';
  };

  const loadModels = async (provider: string) => {
    isLoadingModels.value = true;
    try {
      const apiKey = provider === 'deepseek' ? deepseekApiKey.value : openrouterApiKey.value;
      if (!apiKey) {
        models.value = [];
        return;
      }
      
      const response = await fetch('http://localhost:3002/api/models/' + provider, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      if (!response.ok) {
        throw new Error('Failed to load models');
      }
      
      const data = await response.json();
      models.value = data.models || [];
      
      if (!selectedModel.value || !models.value.find(m => m.id === selectedModel.value)) {
        selectedModel.value = models.value[0]?.id || '';
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      models.value = [];
    } finally {
      isLoadingModels.value = false;
    }
  };

  return {
    deepseekApiKey,
    openrouterApiKey,
    temperature,
    selectedProvider,
    selectedModel,
    models,
    isLoading,
    isLoadingModels,
    loadSettings,
    updateSettings,
    loadModels,
  };
});
