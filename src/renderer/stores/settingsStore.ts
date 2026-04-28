import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi, modelsApi } from '../utils/api';
import { ElMessage } from 'element-plus';
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
  /** DeepSeek 推理努力程度（可选值：high/max，默认 high） */
  const reasoningEffort = ref('high');
  // 记录解密失败的 API 密钥 key 名称，供组件读取以显示提示
  const decryptFailedKeys = ref<string[]>([]);

  // API 密钥名称到友好名称的映射
  const apiKeyLabels: Record<string, string> = {
    deepseek_api_key: 'DeepSeek',
    openrouter_api_key: 'OpenRouter',
  };

  // 检查并提示解密失败的 API 密钥
  const checkDecryptFailed = (failedKeys: string[]) => {
    if (!failedKeys || failedKeys.length === 0) return;

    // 保存失败的 key 供组件使用
    decryptFailedKeys.value = failedKeys;

    const labels = failedKeys
      .map(key => apiKeyLabels[key] || key)
      .join('、');

    ElMessage({
      message: `检测到以下 API 密钥无法解密：${labels}。可能是因为容器重建导致加密密钥变化，请重新输入相关密钥。`,
      type: 'warning',
      duration: 8000,
      showClose: true,
    });
  };

  const loadSettings = async () => {
    isLoading.value = true;
    try {
      const response = await settingsApi.get();
      const settings = response.data;

      // 检查是否有解密失败的 API 密钥
      const decryptFailed = settings._decryptFailed as string[] | undefined;
      if (decryptFailed) {
        checkDecryptFailed(decryptFailed);
        delete settings._decryptFailed;
      }

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

      // 检查是否有解密失败的 API 密钥
      const decryptFailed = updated._decryptFailed as string[] | undefined;
      if (decryptFailed) {
        checkDecryptFailed(decryptFailed);
        delete updated._decryptFailed;
      }

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
    decryptFailedKeys,
    loadSettings,
    updateSettings,
    loadModels,
  };
});
