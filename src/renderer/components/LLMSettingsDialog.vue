<template>
  <el-dialog
    v-model="visible"
    title="LLM设置"
    width="600px"
    @close="handleClose"
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane label="DeepSeek" name="deepseek">
        <div style="padding: 16px 0">
          <p style="font-size: 14px; color: #666; margin-bottom: 16px">
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
      <el-tab-pane label="OpenAI" name="openai">
        <div style="padding: 16px 0">
          <p style="font-size: 14px; color: #666; margin-bottom: 16px">
            输入您的OpenAI API密钥。密钥将加密存储在本地。
          </p>
          <el-input
            v-model="openaiKey"
            type="password"
            placeholder="sk-..."
            show-password
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-alert
      v-if="message"
      :type="message.type"
      :title="message.text"
      style="margin-top: 16px"
      :closable="false"
    />

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button v-if="activeTab === 'openai'" type="primary" @click="handleSaveOpenAI">
        保存OpenAI密钥
      </el-button>
      <el-button v-if="activeTab === 'deepseek'" type="primary" @click="handleSaveDeepSeek">
        保存DeepSeek密钥
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../stores/settingsStore';
import { ElMessage } from 'element-plus';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const settingsStore = useSettingsStore();
const { openaiApiKey, deepseekApiKey } = storeToRefs(settingsStore);
const { loadSettings, updateSettings } = settingsStore;

const visible = ref(props.modelValue);
const activeTab = ref('deepseek');
const openaiKey = ref('');
const deepseekKey = ref('');
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null);

watch(
  () => props.modelValue,
  async (val) => {
    visible.value = val;
    if (val) {
      await loadSettings();
    }
  }
);

watch(
  visible,
  (val) => {
    emit('update:modelValue', val);
  }
);

watch(
  () => openaiApiKey.value,
  (val) => {
    openaiKey.value = val;
  }
);

watch(
  () => deepseekApiKey.value,
  (val) => {
    deepseekKey.value = val;
  }
);

const handleSaveOpenAI = async () => {
  try {
    await updateSettings({ openaiApiKey: openaiKey.value });
    ElMessage.success('OpenAI API密钥已保存');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleSaveDeepSeek = async () => {
  try {
    await updateSettings({ deepseekApiKey: deepseekKey.value });
    ElMessage.success('DeepSeek API密钥已保存');
  } catch (error) {
    ElMessage.error('保存失败: ' + (error as Error).message);
  }
};

const handleClose = () => {
  openaiKey.value = '';
  deepseekKey.value = '';
  message.value = null;
  visible.value = false;
};
</script>
