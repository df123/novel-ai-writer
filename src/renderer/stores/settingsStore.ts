import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi, modelsApi } from '../utils/api';
import type { Model } from '../../shared/types';

export const useSettingsStore = defineStore('settings', () => {
  const deepseekApiKey = ref('');
  const openrouterApiKey = ref('');
  const temperature = ref(0.7);
  const selectedProvider = ref('deepseek');
  const selectedModel = ref('deepseek-v4-flash');
  const models = ref<Model[]>([]);
  const isLoading = ref(false);
  const isLoadingModels = ref(false);
  const showThinkingContent = ref(false);
  const showToolCalls = ref(false);
  const reasoningEffort = ref('high');

  const loadSettings = async () => {
    isLoading.value = true;
    try {
      const response = await settingsApi.get();
      const settings = response.data;

      deepseekApiKey.value = settings.deepseek_api_key || '';
      openrouterApiKey.value = settings.openrouter_api_key || '';
      temperature.value = settings.temperature ? parseFloat(settings.temperature) : 0.7;
      selectedProvider.value = settings.selected_provider || 'deepseek';
      selectedModel.value = settings.selected_model || 'deepseek-v4-flash';
      reasoningEffort.value = settings.reasoning_effort || 'high';
      showThinkingContent.value = settings.show_thinking_content === 'true' || settings.show_thinking_content === true;
      showToolCalls.value = settings.show_tool_calls === 'true' || settings.show_tool_calls === true;
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const updateSettings = async (settings: { deepseekApiKey?: string; openrouterApiKey?: string; temperature?: number; selectedProvider?: string; selectedModel?: string; showThinkingContent?: boolean; showToolCalls?: boolean; reasoningEffort?: string }) => {
    isLoading.value = true;
    try {
      const currentSettings: Record<string, string | number> = {};

      if (settings.deepseekApiKey !== undefined) {
        currentSettings.deepseek_api_key = settings.deepseekApiKey;
      }

      if (settings.openrouterApiKey !== undefined) {
        currentSettings.openrouter_api_key = settings.openrouterApiKey;
      }

      if (settings.temperature !== undefined) {
        currentSettings.temperature = settings.temperature;
      }

      if (settings.selectedProvider !== undefined) {
        currentSettings.selected_provider = settings.selectedProvider;
      }

      if (settings.selectedModel !== undefined) {
        currentSettings.selected_model = settings.selectedModel;
      }

      if (settings.showThinkingContent !== undefined) {
        currentSettings.show_thinking_content = settings.showThinkingContent ? 'true' : 'false';
      }

      if (settings.reasoningEffort !== undefined) {
        currentSettings.reasoning_effort = settings.reasoningEffort;
      }

      if (settings.showToolCalls !== undefined) {
        currentSettings.show_tool_calls = settings.showToolCalls ? 'true' : 'false';
      }

      const response = await settingsApi.update(currentSettings);
      const updated = response.data;

      deepseekApiKey.value = updated.deepseek_api_key || '';
      openrouterApiKey.value = updated.openrouter_api_key || '';
      temperature.value = updated.temperature ? parseFloat(updated.temperature) : 0.7;
      selectedProvider.value = updated.selected_provider || 'deepseek';
      selectedModel.value = updated.selected_model || 'deepseek-v4-flash';
      reasoningEffort.value = updated.reasoning_effort || 'high';
      showThinkingContent.value = updated.show_thinking_content === 'true' || updated.show_thinking_content === true;
      showToolCalls.value = updated.show_tool_calls === 'true' || updated.show_tool_calls === true;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const loadModels = async (provider: string) => {
    isLoadingModels.value = true;
    try {
      const apiKey = provider === 'deepseek' ? deepseekApiKey.value : openrouterApiKey.value;
      
      if (provider === 'openrouter' && !apiKey) {
        models.value = [{ id: '', name: '请先配置 OpenRouter API 密钥' }];
        selectedModel.value = '';
        return;
      }
      
      const response = await modelsApi.list(provider, apiKey || 'dummy');
      models.value = response.data.models || [];
      
      if (!selectedModel.value || !models.value.find(m => m.id === selectedModel.value)) {
        selectedModel.value = models.value[0]?.id || '';
      }
    } catch (error) {
      console.error(`Failed to load ${provider} models:`, error);
      
      const errorMessage = provider === 'openrouter' 
        ? '加载模型失败，请检查 API 密钥'
        : '加载模型失败，请稍后重试';
      
      models.value = [{ id: '', name: errorMessage }];
      selectedModel.value = '';
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
    showThinkingContent,
    showToolCalls,
    reasoningEffort,
    loadSettings,
    updateSettings,
    loadModels,
  };
});
