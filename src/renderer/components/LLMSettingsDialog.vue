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
          <el-button type="primary" @click="handleSaveParams">
            保存参数设置
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button v-if="activeTab === 'deepseek'" type="primary" @click="handleSaveDeepSeek">
        保存DeepSeek密钥
      </el-button>
      <el-button v-if="activeTab === 'openrouter'" type="primary" @click="handleSaveOpenRouter">
        保存OpenRouter密钥
      </el-button>
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
const { deepseekApiKey, openrouterApiKey, temperature } = storeToRefs(settingsStore);
const { loadSettings, updateSettings } = settingsStore;

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const activeTab = ref('deepseek');
const deepseekKey = ref('');
const openrouterKey = ref('');
const tempValue = ref(0.7);

watch(visible, async (val) => {
  if (val) {
    await loadSettings();
    tempValue.value = temperature.value;
    deepseekKey.value = deepseekApiKey.value;
    openrouterKey.value = openrouterApiKey.value;
  }
});

const handleSaveDeepSeek = async () => {
  try {
    await updateSettings({ deepseekApiKey: deepseekKey.value });
    ElMessage.success('DeepSeek API密钥已保存');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleSaveOpenRouter = async () => {
  try {
    await updateSettings({ openrouterApiKey: openrouterKey.value });
    ElMessage.success('OpenRouter API密钥已保存');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleSaveParams = async () => {
  try {
    await updateSettings({ temperature: tempValue.value });
    ElMessage.success('参数设置已保存');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleClose = () => {
  deepseekKey.value = deepseekApiKey.value;
  openrouterKey.value = openrouterApiKey.value;
  tempValue.value = temperature.value;
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
</style>
