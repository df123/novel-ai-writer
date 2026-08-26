<template>
  <el-dialog
    v-model="visible"
    title="LLM设置"
    width="600px"
    @close="handleClose"
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane label="DeepSeek" name="deepseek">
        <div class="tab-content">
          <p class="description">
            输入您的DeepSeek API密钥。密钥将加密存储在本地。
          </p>
          <el-input
            v-model="deepseekKey"
            type="password"
            placeholder="sk-..."
            show-password
          />
          <el-alert
            v-if="decryptFailedKeys.includes('deepseek_api_key')"
            title="此密钥因加密密钥变化无法解密，请重新输入"
            type="warning"
            :closable="false"
            show-icon
            class="decrypt-warning"
          />
        </div>
      </el-tab-pane>
      <el-tab-pane label="OpenRouter" name="openrouter">
        <div class="tab-content">
          <p class="description">
            输入您的OpenRouter API密钥。密钥将加密存储在本地。OpenRouter提供统一访问多个AI模型的接口。
          </p>
          <p class="note">
            <a href="https://openrouter.ai/keys" target="_blank" class="link">获取API密钥</a>
          </p>
          <el-input
            v-model="openrouterKey"
            type="password"
            placeholder="sk-or-..."
            show-password
          />
          <el-alert
            v-if="decryptFailedKeys.includes('openrouter_api_key')"
            title="此密钥因加密密钥变化无法解密，请重新输入"
            type="warning"
            :closable="false"
            show-icon
            class="decrypt-warning"
          />
        </div>
      </el-tab-pane>
      <el-tab-pane label="Z.AI" name="zai">
        <div class="tab-content">
          <p class="description">
            输入您的 Z.AI Coding Plan API 密钥。该端点仅适用于编码/Agent 场景，请求会按 OpenCode 客户端方式发送。
          </p>
          <el-input
            v-model="zaiKey"
            type="password"
            placeholder="sk-..."
            show-password
          />
          <el-alert
            v-if="decryptFailedKeys.includes('zai_api_key')"
            title="此密钥因加密密钥变化无法解密，请重新输入"
            type="warning"
            :closable="false"
            show-icon
            class="decrypt-warning"
          />
          <p class="note">
            思考强度适用于 GLM-5.2 / GLM-5.3，Coding Plan 端点会按官方规则映射。
            GLM-5.3 不支持关闭思考，none/minimal/low 会映射为 low；GLM-5.2 的 none/minimal 会停止思考。
          </p>
          <div class="provider-option">
            <div class="switch-item">
              <el-switch v-model="zaiReasoningValue" />
              <span class="switch-label">启用思考强度</span>
            </div>
            <el-select
              v-model="zaiEffortValue"
              :disabled="!zaiReasoningValue"
              size="small"
              class="effort-select"
            >
              <el-option
                label="最大 max"
                value="max"
              />
              <el-option
                label="超高高 xhigh"
                value="xhigh"
              />
              <el-option
                label="高 high"
                value="high"
              />
              <el-option
                label="中 medium"
                value="medium"
              />
              <el-option
                label="低 low"
                value="low"
              />
              <el-option
                label="极低 minimal"
                value="minimal"
              />
              <el-option
                label="none（GLM-5.2 关闭）"
                value="none"
              />
            </el-select>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="OpenCode" name="opencode">
        <div class="tab-content">
          <p class="description">
            输入您的 OpenCode API 密钥。模型列表会同时包含 Zen（opencode/）和 Go（opencode-go/）端点。
          </p>
          <el-input
            v-model="opencodeKey"
            type="password"
            placeholder="sk-..."
            show-password
          />
          <el-alert
            v-if="decryptFailedKeys.includes('opencode_api_key')"
            title="此密钥因加密密钥变化无法解密，请重新输入"
            type="warning"
            :closable="false"
            show-icon
            class="decrypt-warning"
          />
          <div class="provider-option">
            <div class="switch-item">
              <el-switch v-model="opencodeReasoningValue" />
              <span class="switch-label">启用推理强度</span>
            </div>
            <el-select
              v-model="opencodeEffortValue"
              :disabled="!opencodeReasoningValue"
              size="small"
              class="effort-select"
            >
              <el-option label="不推理" value="none" />
              <el-option label="极低" value="minimal" />
              <el-option label="低" value="low" />
              <el-option label="中" value="medium" />
              <el-option label="高" value="high" />
            </el-select>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="CLI Proxy API" name="cliproxy">
        <div class="tab-content">
          <p class="description">
            输入本地 CLI Proxy API 的密钥和 OpenAI 兼容基础地址。模型列表会从该服务的 /models 接口动态获取。
          </p>
          <el-input
            v-model="cliproxyKey"
            type="password"
            placeholder="API Key"
            show-password
            class="stack-input"
          />
          <el-input
            v-model="cliproxyBaseUrlValue"
            placeholder="http://127.0.0.1:8317/v1"
            class="stack-input"
          />
          <el-alert
            v-if="decryptFailedKeys.includes('cliproxy_api_key')"
            title="此密钥因加密密钥变化无法解密，请重新输入"
            type="warning"
            :closable="false"
            show-icon
            class="decrypt-warning"
          />
          <div class="provider-option">
            <div class="switch-item">
              <el-switch v-model="cliproxyReasoningValue" />
              <span class="switch-label">启用推理强度</span>
            </div>
            <el-select
              v-model="cliproxyEffortValue"
              :disabled="!cliproxyReasoningValue"
              size="small"
              class="effort-select"
            >
              <el-option label="自动" value="auto" />
              <el-option label="不推理" value="none" />
              <el-option label="低" value="low" />
              <el-option label="中" value="medium" />
              <el-option label="高" value="high" />
            </el-select>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="模型参数" name="params">
        <div class="tab-content">
          <div class="param-section">
            <label class="param-label">
              Temperature
            </label>
            <p class="param-description">
              控制模型输出的随机性。值越高输出越随机，值越低输出越确定。建议范围：0.0 - 1.0
            </p>
            <el-slider
              v-model="tempValue"
              :min="0"
              :max="2"
              :step="0.1"
              :marks="{ 0: '0.0', 0.7: '0.7', 1.0: '1.0', 2.0: '2.0' }"
              show-stops
              class="slider"
            />
            <div class="temp-display">
              {{ tempValue }}
            </div>
          </div>
          <div class="param-section">
            <label class="param-label">
              显示选项
            </label>
            <div class="switch-item">
              <el-switch v-model="showThinkingValue" />
              <span class="switch-label">显示思考过程</span>
            </div>
            <p class="param-description">
              开启后会在AI回答下方显示模型的思考过程（思维链）。
            </p>
            <div class="switch-item">
              <el-switch v-model="showToolCallsValue" />
              <span class="switch-label">显示工具调用</span>
            </div>
            <p class="param-description">
              开启后会在AI回答下方显示模型的工具调用信息。
            </p>
          </div>
          <el-button type="primary" @click="handleSaveParams">
            保存参数设置
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="dialog-footer">
        <span class="model-cache-status">{{ modelCacheText }}</span>
        <div>
          <el-button @click="handleClose">关闭</el-button>
          <el-button
            v-if="activeTab !== 'params'"
            :disabled="isModelConfigDirty"
            :loading="isLoadingModels"
            @click="handleRefreshModels"
          >
            刷新模型列表
          </el-button>
          <el-button v-if="activeTab === 'deepseek'" type="primary" @click="handleSaveDeepSeek">
            保存DeepSeek密钥
          </el-button>
          <el-button v-if="activeTab === 'openrouter'" type="primary" @click="handleSaveOpenRouter">
            保存OpenRouter密钥
          </el-button>
          <el-button v-if="activeTab === 'zai'" type="primary" @click="handleSaveZai">
            保存Z.AI设置
          </el-button>
          <el-button v-if="activeTab === 'opencode'" type="primary" @click="handleSaveOpencode">
            保存OpenCode设置
          </el-button>
          <el-button v-if="activeTab === 'cliproxy'" type="primary" @click="handleSaveCliproxy">
            保存CLI Proxy API设置
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../stores/settingsStore';
import { ElMessage } from 'element-plus';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const settingsStore = useSettingsStore();
const {
  deepseekApiKey,
  openrouterApiKey,
  zaiApiKey,
  opencodeApiKey,
  cliproxyApiKey,
  cliproxyBaseUrl,
  temperature,
  showThinkingContent,
  showToolCalls,
  opencodeReasoningEnabled,
  opencodeReasoningEffort,
  cliproxyReasoningEnabled,
  cliproxyReasoningEffort,
  decryptFailedKeys,
  isLoadingModels,
  modelCaches,
} = storeToRefs(settingsStore);
const { loadSettings, updateSettings, refreshModels } = settingsStore;

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const activeTab = ref('deepseek');
const deepseekKey = ref('');
const openrouterKey = ref('');
const zaiKey = ref('');
const opencodeKey = ref('');
const cliproxyKey = ref('');
const cliproxyBaseUrlValue = ref('http://127.0.0.1:8317/v1');
const tempValue = ref(0.7);
const showThinkingValue = ref(false);
const showToolCallsValue = ref(false);
const zaiReasoningValue = ref(true);
const zaiEffortValue = ref('max');
const opencodeReasoningValue = ref(false);
const opencodeEffortValue = ref('none');
const cliproxyReasoningValue = ref(false);
const cliproxyEffortValue = ref('auto');

const isModelConfigDirty = computed(() => {
  switch (activeTab.value) {
    case 'deepseek':
      return deepseekKey.value !== deepseekApiKey.value;
    case 'openrouter':
      return openrouterKey.value !== openrouterApiKey.value;
    case 'zai':
      return zaiKey.value !== zaiApiKey.value;
    case 'opencode':
      return opencodeKey.value !== opencodeApiKey.value;
    case 'cliproxy':
      return cliproxyKey.value !== cliproxyApiKey.value ||
        cliproxyBaseUrlValue.value !== cliproxyBaseUrl.value;
    default:
      return false;
  }
});

const modelCacheText = computed(() => {
  if (activeTab.value === 'params') return '';

  const cache = modelCaches.value[activeTab.value];
  if (!cache) return '模型列表未缓存';

  const time = new Date(cache.fetchedAt).toLocaleString();
  return `已缓存 ${cache.models.length} 个模型 · ${time}`;
});

const handleRefreshModels = async () => {
  if (isModelConfigDirty.value) {
    ElMessage.warning('请先保存当前提供商配置，再刷新模型列表');
    return;
  }

  const success = await refreshModels(activeTab.value);
  if (success) {
    ElMessage.success('模型列表已刷新并缓存');
  } else {
    ElMessage.error(settingsStore.lastModelError || '刷新模型列表失败');
  }
};

watch(visible, async (val) => {
  if (val) {
    await loadSettings();
    tempValue.value = temperature.value;
    deepseekKey.value = deepseekApiKey.value;
    openrouterKey.value = openrouterApiKey.value;
    zaiKey.value = zaiApiKey.value;
    opencodeKey.value = opencodeApiKey.value;
    cliproxyKey.value = cliproxyApiKey.value;
    cliproxyBaseUrlValue.value = cliproxyBaseUrl.value;
    showThinkingValue.value = showThinkingContent.value;
    showToolCallsValue.value = showToolCalls.value;
    zaiReasoningValue.value = settingsStore.zaiReasoningEnabled;
    zaiEffortValue.value = settingsStore.zaiReasoningEffort;
    opencodeReasoningValue.value = opencodeReasoningEnabled.value;
    opencodeEffortValue.value = opencodeReasoningEffort.value;
    cliproxyReasoningValue.value = cliproxyReasoningEnabled.value;
    cliproxyEffortValue.value = cliproxyReasoningEffort.value;
  }
});

const handleSaveDeepSeek = async () => {
  try {
    await updateSettings({ deepseekApiKey: deepseekKey.value });
    ElMessage.success('DeepSeek API密钥已保存，模型列表需手动刷新');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleSaveOpenRouter = async () => {
  try {
    await updateSettings({ openrouterApiKey: openrouterKey.value });
    ElMessage.success('OpenRouter API密钥已保存，模型列表需手动刷新');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleSaveZai = async () => {
  try {
    await updateSettings({
      zaiApiKey: zaiKey.value,
      zaiReasoningEnabled: zaiReasoningValue.value,
      zaiReasoningEffort: zaiEffortValue.value,
    });
    ElMessage.success('Z.AI设置已保存，模型列表需手动刷新');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleSaveOpencode = async () => {
  try {
    await updateSettings({
      opencodeApiKey: opencodeKey.value,
      opencodeReasoningEnabled: opencodeReasoningValue.value,
      opencodeReasoningEffort: opencodeEffortValue.value,
    });
    ElMessage.success('OpenCode设置已保存，模型列表需手动刷新');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleSaveCliproxy = async () => {
  try {
    await updateSettings({
      cliproxyApiKey: cliproxyKey.value,
      cliproxyBaseUrl: cliproxyBaseUrlValue.value,
      cliproxyReasoningEnabled: cliproxyReasoningValue.value,
      cliproxyReasoningEffort: cliproxyEffortValue.value,
    });
    ElMessage.success('CLI Proxy API设置已保存，模型列表需手动刷新');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleSaveParams = async () => {
  try {
    await updateSettings({
      temperature: tempValue.value,
      showThinkingContent: showThinkingValue.value,
      showToolCalls: showToolCallsValue.value,
    });
    ElMessage.success('参数设置已保存');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleClose = () => {
  deepseekKey.value = deepseekApiKey.value;
  openrouterKey.value = openrouterApiKey.value;
  zaiKey.value = zaiApiKey.value;
  opencodeKey.value = opencodeApiKey.value;
  cliproxyKey.value = cliproxyApiKey.value;
  cliproxyBaseUrlValue.value = cliproxyBaseUrl.value;
  tempValue.value = temperature.value;
  showThinkingValue.value = showThinkingContent.value;
  showToolCallsValue.value = showToolCalls.value;
  zaiReasoningValue.value = settingsStore.zaiReasoningEnabled;
  zaiEffortValue.value = settingsStore.zaiReasoningEffort;
  opencodeReasoningValue.value = opencodeReasoningEnabled.value;
  opencodeEffortValue.value = opencodeReasoningEffort.value;
  cliproxyReasoningValue.value = cliproxyReasoningEnabled.value;
  cliproxyEffortValue.value = cliproxyReasoningEffort.value;
  visible.value = false;
};
</script>

<style scoped>
.tab-content {
  padding: 16px 0;
}

.description {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
}

.note {
  font-size: 12px;
  color: #999;
  margin-bottom: 12px;
}

.link {
  color: #409eff;
  text-decoration: none;
}

.param-section {
  margin-bottom: 24px;
}

.param-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.param-description {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
}

.slider {
  margin-bottom: 12px;
}

.temp-display {
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  color: #409eff;
}

.decrypt-warning {
  margin-top: 12px;
}

.stack-input + .stack-input {
  margin-top: 12px;
}

.provider-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.switch-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-label {
  font-size: 14px;
}

.effort-select {
  width: 110px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.model-cache-status {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  color: #909399;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .dialog-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
