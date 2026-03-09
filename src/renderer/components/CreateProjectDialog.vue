<template>
  <el-dialog
    v-model="visible"
    title="创建新项目"
    width="500px"
    @close="handleClose"
  >
    <el-form label-width="80px">
      <el-form-item label="项目标题">
        <el-input v-model="title" placeholder="请输入项目标题" />
      </el-form-item>
      <el-form-item label="项目描述">
        <el-input
          v-model="description"
          type="textarea"
          :rows="4"
          placeholder="请输入项目描述（可选）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :disabled="!title.trim()" @click="handleSubmit">
        创建
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useProjectStore } from '../stores/projectStore';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const projectStore = useProjectStore();
const { createProject } = projectStore;

const visible = ref(props.modelValue);
const title = ref('');
const description = ref('');

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val;
  }
);

watch(
  visible,
  (val) => {
    emit('update:modelValue', val);
  }
);

const handleSubmit = async () => {
  if (!title.value.trim()) return;

  try {
    await createProject(title.value, description.value);
    title.value = '';
    description.value = '';
    visible.value = false;
  } catch (error) {
    console.error('Failed to create project:', error);
  }
};

const handleClose = () => {
  title.value = '';
  description.value = '';
  visible.value = false;
};
</script>
