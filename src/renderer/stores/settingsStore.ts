import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi, modelsApi, webSecurity } from '../utils/api';
import { ElMessage } from 'element-plus';
import { useAuthStore } from './authStore';
import type { Model } from '../../shared/types';

interface ModelCacheEntry {
  models: Model[];
  fetchedAt: number;
  signature: string;
}

const MODEL_CACHE_STORAGE_KEY = 'novel-ai:model-caches:v1';

function readModelCaches(): Record<string, ModelCacheEntry> {
  try {
    const raw = localStorage.getItem(MODEL_CACHE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, ModelCacheEntry>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, entry]) =>
        Array.isArray(entry.models) &&
        typeof entry.fetchedAt === 'number' &&
        typeof entry.signature === 'string'
      )
    );
  } catch (error) {
    console.error('Failed to read model cache:', error);
    return {};
  }
}

function writeModelCaches(caches: Record<string, ModelCacheEntry>): void {
  try {
    localStorage.setItem(MODEL_CACHE_STORAGE_KEY, JSON.stringify(caches));
  } catch (error) {
    console.error('Failed to write model cache:', error);
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const authStore = useAuthStore();
  const deepseekApiKey = ref('');
  const openrouterApiKey = ref('');
  const zaiApiKey = ref('');
  const opencodeApiKey = ref('');
  const cliproxyApiKey = ref('');
  const cliproxyBaseUrl = ref('http://127.0.0.1:8317/v1');
  // public 模式下密钥不下发浏览器，仅保留"是否已配置"标记（设计书 §20/§22）
  const providerConfigured = ref<Record<string, boolean>>({});
  // 模型缓存签名改用服务端配置版本号，不再由密钥派生任何本地数据（设计书 §22）
  const providerConfigVersion = ref(1);
  const temperature = ref(0.7);
  const selectedProvider = ref('deepseek');
  const selectedModel = ref('deepseek-v4-flash');
  const models = ref<Model[]>([]);
  const modelCaches = ref<Record<string, ModelCacheEntry>>(readModelCaches());
  const isLoading = ref(false);
  const isLoadingModels = ref(false);
  const modelRequestSequence = ref(0);
  const lastModelError = ref('');
  const showThinkingContent = ref(false);
  const showToolCalls = ref(false);
  /** DeepSeek 推理努力程度（可选值：high/max，默认 high） */
  const reasoningEffort = ref('high');
  const zaiReasoningEnabled = ref(true);
  const zaiReasoningEffort = ref('max');
  const opencodeReasoningEnabled = ref(false);
  const opencodeReasoningEffort = ref('none');
  const cliproxyReasoningEnabled = ref(false);
  const cliproxyReasoningEffort = ref('auto');
  const researchWebSearchEnabled = ref(true);
  const researchWebReaderEnabled = ref(true);
  const researchWikipediaEnabled = ref(true);
  const researchWeatherEnabled = ref(true);
  const researchBooksEnabled = ref(true);
  // 记录解密失败的 API 密钥 key 名称，供组件读取以显示提示
  const decryptFailedKeys = ref<string[]>([]);

  // API 密钥名称到友好名称的映射
  const apiKeyLabels: Record<string, string> = {
    deepseek_api_key: 'DeepSeek',
    openrouter_api_key: 'OpenRouter',
    zai_api_key: 'Z.AI',
    opencode_api_key: 'OpenCode',
    cliproxy_api_key: 'CLI Proxy API',
  };

  const providerLabels: Record<string, string> = {
    deepseek: 'DeepSeek',
    openrouter: 'OpenRouter',
    zai: 'Z.AI',
    opencode: 'OpenCode',
    cliproxy: 'CLI Proxy API',
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

  // public 模式：密钥值为空、只更新 configured 标记；local 模式：完整回显（现状）
  const applySettingsResponse = (settings: Record<string, unknown>) => {
    const decryptFailed = settings._decryptFailed as string[] | undefined;
    if (decryptFailed) {
      checkDecryptFailed(decryptFailed);
      delete settings._decryptFailed;
    }

    const isPublic = authStore.appMode === 'public' || webSecurity.isPublicMode();
    providerConfigVersion.value = Number(settings.providerConfigVersion) || 1;

    if (isPublic) {
      deepseekApiKey.value = '';
      openrouterApiKey.value = '';
      zaiApiKey.value = '';
      opencodeApiKey.value = '';
      cliproxyApiKey.value = '';
      cliproxyBaseUrl.value = '';
      providerConfigured.value = {
        deepseek: settings.deepseek_api_key_configured === true,
        openrouter: settings.openrouter_api_key_configured === true,
        zai: settings.zai_api_key_configured === true,
        opencode: settings.opencode_api_key_configured === true,
        cliproxy: settings.cliproxy_api_key_configured === true
      };
    } else {
      deepseekApiKey.value = (settings.deepseek_api_key as string) || '';
      openrouterApiKey.value = (settings.openrouter_api_key as string) || '';
      zaiApiKey.value = (settings.zai_api_key as string) || '';
      opencodeApiKey.value = (settings.opencode_api_key as string) || '';
      cliproxyApiKey.value = (settings.cliproxy_api_key as string) || '';
      cliproxyBaseUrl.value = (settings.cliproxy_base_url as string) || 'http://127.0.0.1:8317/v1';
      providerConfigured.value = {};
    }

    temperature.value = settings.temperature ? parseFloat(String(settings.temperature)) : 0.7;
    selectedProvider.value = (settings.selected_provider as string) || 'deepseek';
    selectedModel.value = (settings.selected_model as string) || 'deepseek-v4-flash';
    reasoningEffort.value = (settings.reasoning_effort as string) || 'high';
    zaiReasoningEnabled.value = settings.zai_reasoning_enabled !== 'false';
    zaiReasoningEffort.value = (settings.zai_reasoning_effort as string) || 'max';
    opencodeReasoningEnabled.value = settings.opencode_reasoning_enabled === 'true';
    opencodeReasoningEffort.value = (settings.opencode_reasoning_effort as string) || 'none';
    cliproxyReasoningEnabled.value = settings.cliproxy_reasoning_enabled === 'true';
    cliproxyReasoningEffort.value = (settings.cliproxy_reasoning_effort as string) || 'auto';
    researchWebSearchEnabled.value = settings.research_web_search_enabled !== 'false';
    researchWebReaderEnabled.value = settings.research_web_reader_enabled !== 'false';
    researchWikipediaEnabled.value = settings.research_wikipedia_enabled !== 'false';
    researchWeatherEnabled.value = settings.research_weather_enabled !== 'false';
    researchBooksEnabled.value = settings.research_books_enabled !== 'false';
    showThinkingContent.value = settings.show_thinking_content === 'true' || settings.show_thinking_content === true;
    showToolCalls.value = settings.show_tool_calls === 'true' || settings.show_tool_calls === true;
  };

  const loadSettings = async () => {
    isLoading.value = true;
    try {
      const response = await settingsApi.get();
      applySettingsResponse(response.data as Record<string, unknown>);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const updateSettings = async (settings: {
    deepseekApiKey?: string;
    openrouterApiKey?: string;
    zaiApiKey?: string;
    opencodeApiKey?: string;
    cliproxyApiKey?: string;
    cliproxyBaseUrl?: string;
    temperature?: number;
    selectedProvider?: string;
    selectedModel?: string;
    showThinkingContent?: boolean;
    showToolCalls?: boolean;
    reasoningEffort?: string;
    zaiReasoningEnabled?: boolean;
    zaiReasoningEffort?: string;
    opencodeReasoningEnabled?: boolean;
    opencodeReasoningEffort?: string;
    cliproxyReasoningEnabled?: boolean;
    cliproxyReasoningEffort?: string;
    researchWebSearchEnabled?: boolean;
    researchWebReaderEnabled?: boolean;
    researchWikipediaEnabled?: boolean;
    researchWeatherEnabled?: boolean;
    researchBooksEnabled?: boolean;
  }) => {
    isLoading.value = true;
    try {
      const currentSettings: Record<string, string | number> = {};

      if (settings.deepseekApiKey !== undefined) {
        currentSettings.deepseek_api_key = settings.deepseekApiKey;
      }

      if (settings.openrouterApiKey !== undefined) {
        currentSettings.openrouter_api_key = settings.openrouterApiKey;
      }

      if (settings.zaiApiKey !== undefined) {
        currentSettings.zai_api_key = settings.zaiApiKey;
      }

      if (settings.opencodeApiKey !== undefined) {
        currentSettings.opencode_api_key = settings.opencodeApiKey;
      }

      if (settings.cliproxyApiKey !== undefined) {
        currentSettings.cliproxy_api_key = settings.cliproxyApiKey;
      }

      if (settings.cliproxyBaseUrl !== undefined) {
        currentSettings.cliproxy_base_url = settings.cliproxyBaseUrl;
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

      if (settings.zaiReasoningEnabled !== undefined) {
        currentSettings.zai_reasoning_enabled = settings.zaiReasoningEnabled ? 'true' : 'false';
      }

      if (settings.zaiReasoningEffort !== undefined) {
        currentSettings.zai_reasoning_effort = settings.zaiReasoningEffort;
      }

      if (settings.opencodeReasoningEnabled !== undefined) {
        currentSettings.opencode_reasoning_enabled = settings.opencodeReasoningEnabled ? 'true' : 'false';
      }

      if (settings.opencodeReasoningEffort !== undefined) {
        currentSettings.opencode_reasoning_effort = settings.opencodeReasoningEffort;
      }

      if (settings.cliproxyReasoningEnabled !== undefined) {
        currentSettings.cliproxy_reasoning_enabled = settings.cliproxyReasoningEnabled ? 'true' : 'false';
      }

      if (settings.cliproxyReasoningEffort !== undefined) {
        currentSettings.cliproxy_reasoning_effort = settings.cliproxyReasoningEffort;
      }

      if (settings.researchWebSearchEnabled !== undefined) {
        currentSettings.research_web_search_enabled = settings.researchWebSearchEnabled ? 'true' : 'false';
      }

      if (settings.researchWebReaderEnabled !== undefined) {
        currentSettings.research_web_reader_enabled = settings.researchWebReaderEnabled ? 'true' : 'false';
      }

      if (settings.researchWikipediaEnabled !== undefined) {
        currentSettings.research_wikipedia_enabled = settings.researchWikipediaEnabled ? 'true' : 'false';
      }

      if (settings.researchWeatherEnabled !== undefined) {
        currentSettings.research_weather_enabled = settings.researchWeatherEnabled ? 'true' : 'false';
      }

      if (settings.researchBooksEnabled !== undefined) {
        currentSettings.research_books_enabled = settings.researchBooksEnabled ? 'true' : 'false';
      }

      if (settings.showToolCalls !== undefined) {
        currentSettings.show_tool_calls = settings.showToolCalls ? 'true' : 'false';
      }

      // 公网模式：内部服务地址由服务器环境变量管理，不随请求提交（会被白名单 400 拒绝）
      if (authStore.appMode === 'public' || webSecurity.isPublicMode()) {
        delete currentSettings.cliproxy_base_url;
      }

      const response = await settingsApi.update(currentSettings);
      const previousVersion = providerConfigVersion.value;
      applySettingsResponse(response.data as Record<string, unknown>);

      // 配置版本变化（含密钥更新）即失效全部模型缓存
      if (providerConfigVersion.value !== previousVersion) {
        modelCaches.value = {};
        writeModelCaches({});
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const getProviderApiKey = (provider: string): string => ({
    deepseek: deepseekApiKey.value,
    openrouter: openrouterApiKey.value,
    zai: zaiApiKey.value,
    opencode: opencodeApiKey.value,
    cliproxy: cliproxyApiKey.value
  })[provider] || '';

  // 缓存签名只依赖服务端配置版本（密钥变更时版本自增），本地不保存任何密钥派生值
  const getProviderSignature = (provider: string): string => `v${providerConfigVersion.value}:${provider}`;

  const applyModels = (provider: string, nextModels: Model[]) => {
    if (selectedProvider.value !== provider) return;

    models.value = nextModels;
    if (!selectedModel.value || !nextModels.some(model => model.id === selectedModel.value)) {
      selectedModel.value = nextModels[0]?.id || '';
    }
  };

  const showModelsMessage = (provider: string, message: string) => {
    if (selectedProvider.value !== provider) return;

    models.value = [{ id: '', name: message }];
    selectedModel.value = '';
  };

  const loadModels = async (
    provider: string,
    options: { force?: boolean } = {}
  ): Promise<boolean> => {
    const requestId = ++modelRequestSequence.value;
    const signature = getProviderSignature(provider);
    const cached = modelCaches.value[provider];

    if (cached?.signature === signature && !options.force) {
      lastModelError.value = '';
      applyModels(provider, cached.models);
      return true;
    }

    const apiKey = getProviderApiKey(provider);
    const isPublic = authStore.appMode === 'public' || webSecurity.isPublicMode();
    // 公网模式：凭据在服务端解析，本地只看 configured 标记
    if (isPublic) {
      if (!providerConfigured.value[provider]) {
        lastModelError.value = `请先在设置中配置 ${providerLabels[provider]} API 密钥`;
        showModelsMessage(provider, lastModelError.value);
        return false;
      }
    } else if (['deepseek', 'openrouter', 'zai', 'opencode', 'cliproxy'].includes(provider) && !apiKey) {
      lastModelError.value = `请先配置 ${providerLabels[provider]} API 密钥`;
      showModelsMessage(provider, lastModelError.value);
      return false;
    }

    isLoadingModels.value = true;
    try {
      const response = await modelsApi.list(
        provider,
        isPublic ? undefined : (apiKey || 'dummy'),
        provider === 'cliproxy' && !isPublic ? cliproxyBaseUrl.value : undefined
      );
      const nextModels = response.data.models || [];
      if (requestId !== modelRequestSequence.value) return false;

      const nextCaches = {
        ...modelCaches.value,
        [provider]: {
          models: nextModels,
          fetchedAt: Date.now(),
          signature
        }
      };
      modelCaches.value = nextCaches;
      writeModelCaches(nextCaches);
      lastModelError.value = '';
      applyModels(provider, nextModels);
      return true;
    } catch (error) {
      console.error(`Failed to load ${provider} models:`, error);
      if (requestId !== modelRequestSequence.value) return false;

      lastModelError.value = ['openrouter', 'opencode', 'cliproxy'].includes(provider)
        ? '加载模型失败，请检查 API 密钥和 Base URL'
        : '加载模型失败，请稍后重试';

      if (cached?.signature === signature) {
        applyModels(provider, cached.models);
      } else {
        showModelsMessage(provider, lastModelError.value);
      }
      return false;
    } finally {
      if (requestId === modelRequestSequence.value) {
        isLoadingModels.value = false;
      }
    }
  };

  const refreshModels = async (provider: string): Promise<boolean> =>
    loadModels(provider, { force: true });

  return {
    deepseekApiKey,
    openrouterApiKey,
    zaiApiKey,
    opencodeApiKey,
    cliproxyApiKey,
    cliproxyBaseUrl,
    providerConfigured,
    providerConfigVersion,
    temperature,
    selectedProvider,
    selectedModel,
    models,
    modelCaches,
    isLoading,
    isLoadingModels,
    lastModelError,
    showThinkingContent,
    showToolCalls,
    reasoningEffort,
    zaiReasoningEnabled,
    zaiReasoningEffort,
    opencodeReasoningEnabled,
    opencodeReasoningEffort,
    cliproxyReasoningEnabled,
    cliproxyReasoningEffort,
    researchWebSearchEnabled,
    researchWebReaderEnabled,
    researchWikipediaEnabled,
    researchWeatherEnabled,
    researchBooksEnabled,
    decryptFailedKeys,
    loadSettings,
    updateSettings,
    loadModels,
    refreshModels,
  };
});
