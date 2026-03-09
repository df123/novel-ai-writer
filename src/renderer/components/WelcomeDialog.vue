<template>
  <el-dialog
    v-model="visible"
    title="欢迎使用 NovelAI Writer"
    width="600px"
    @close="handleClose"
  >
    <div style="margin-bottom: 24px">
      <p style="font-size: 14px; line-height: 1.6">
        NovelAI Writer 是一款利用大语言模型辅助小说写作的桌面应用。
      </p>
      <p style="font-size: 14px; color: #666; margin: 8px 0">主要功能：</p>
      <ul style="padding-left: 24px; margin: 8px 0">
        <li style="font-size: 14px; margin-bottom: 8px">LLM写作区：与AI助手进行对话，获取写作建议和内容生成</li>
        <li style="font-size: 14px; margin-bottom: 8px">时间线管理：创建和管理小说的时间节点、事件顺序</li>
        <li style="font-size: 14px; margin-bottom: 8px">人物线管理：创建角色设定、关系网络和发展轨迹</li>
        <li style="font-size: 14px; margin-bottom: 8px">上下文注入：自动将时间线和人物信息注入到对话中</li>
        <li style="font-size: 14px; margin-bottom: 8px">导出功能：支持导出为Markdown和文本格式</li>
      </ul>
    </div>
    
    <div
      v-if="projects.length === 0"
      style="background-color: #f5f7fa; padding: 16px; border-radius: 4px"
    >
      <p style="font-size: 14px; font-weight: 500; margin-bottom: 8px">开始使用</p>
      <p style="font-size: 14px; color: #666">
        点击下方按钮创建您的第一个项目，然后在设置中配置LLM API密钥。
      </p>
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button v-if="projects.length === 0" type="primary" @click="showCreateProject = true">
        创建第一个项目
      </el-button>
    </template>
  </el-dialog>

  <CreateProjectDialog
    v-model="showCreateProject"
    @close="showCreateProject = false"
  />
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '../stores/projectStore';
import CreateProjectDialog from './CreateProjectDialog.vue';

const projectStore = useProjectStore();
const { projects } = storeToRefs(projectStore);

interface Props {
  modelValue?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const showCreateProject = ref(false);

const isOpen = computed(() => {
  return props.modelValue !== undefined ? props.modelValue : projects.value.length === 0;
});

const visible = ref(isOpen.value);

watch(isOpen, (val) => {
  visible.value = val;
});

watch(visible, (val) => {
  if (props.modelValue !== undefined) {
    emit('update:modelValue', val);
  }
});

const handleClose = () => {
  visible.value = false;
  emit('close');
};
</script>
