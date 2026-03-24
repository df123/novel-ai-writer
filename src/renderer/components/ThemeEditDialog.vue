<template>
  <el-dialog
    v-model="dialogVisible"
    :title="editMode ? '编辑主旨' : '创建主旨'"
    width="600px"
    :close-on-click-modal="false"
  >
    <el-form label-width="80px">
      <el-form-item label="主旨标题">
        <el-input
          v-model="title"
          placeholder="请输入主旨标题"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="主旨内容">
        <el-input
          v-model="content"
          type="textarea"
          :rows="10"
          placeholder="请输入主旨内容（故事概述、类型、世界背景等）"
          maxlength="5000"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button
        type="primary"
        :disabled="!title.trim() || !content.trim()"
        :loading="isSubmitting"
        @click="handleSubmit"
      >
        {{ editMode ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useThemeStore } from '../stores/themeStore';
import { useProjectStore } from '../stores/projectStore';
import type { Theme } from '@shared/types';

interface Props {
  modelValue: boolean;
  theme?: Theme | null;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const themeStore = useThemeStore();
const projectStore = useProjectStore();

const dialogVisible = ref(false);
const editMode = ref(false);
const editId = ref<string | null>(null);
const title = ref('');
const content = ref('');
const isSubmitting = ref(false);

watch(
  () => props.modelValue,
  (value) => {
    dialogVisible.value = value;
  }
);

watch(
  dialogVisible,
  (value) => {
    emit('update:modelValue', value);
    if (!value) {
      resetForm();
    }
  }
);

watch(
  () => props.theme,
  (theme) => {
    if (theme) {
      editMode.value = true;
      editId.value = theme.id;
      title.value = theme.title;
      content.value = theme.content;
    } else {
      editMode.value = false;
      editId.value = null;
      title.value = '';
      content.value = '';
    }
  },
  { immediate: true }
);

const resetForm = () => {
  editMode.value = false;
  editId.value = null;
  title.value = '';
  content.value = '';
  isSubmitting.value = false;
};

const handleCancel = () => {
  dialogVisible.value = false;
};

const handleSubmit = async () => {
  if (!title.value.trim() || !content.value.trim()) {
    ElMessage.warning('请填写完整的主旨信息');
    return;
  }

  if (!projectStore.currentProject) {
    ElMessage.error('请先选择项目');
    return;
  }

  isSubmitting.value = true;
  try {
    if (editMode.value && editId.value) {
      // 更新主旨
      await themeStore.updateTheme(editId.value, {
        title: title.value,
        content: content.value,
      });
      ElMessage.success('保存成功');
    } else {
      // 创建新主旨
      await themeStore.createTheme(projectStore.currentProject.id, {
        title: title.value,
        content: content.value,
      });
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    emit('success');
  } catch (error) {
    console.error('保存主旨失败:', error);
    ElMessage.error('保存失败，请重试');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
</style>
