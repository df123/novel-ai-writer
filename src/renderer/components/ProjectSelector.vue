<template>
  <div v-if="projects.length > 0" style="min-width: 200px; margin-left: 8px" v-bind="$attrs">
    <el-select
      v-model="selectedProjectId"
      placeholder="选择项目"
      size="small"
      style="width: 100%"
    >
      <el-option
        v-for="project in projects"
        :key="project.id"
        :label="project.title"
        :value="project.id"
      >
        <template #default>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%">
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
              {{ project.title }}
            </span>
            <el-icon
              :size="14"
              @click.stop="handleDeleteProject(project.id)"
              style="margin-left: 8px; cursor: pointer"
            >
              <Delete />
            </el-icon>
          </div>
        </template>
      </el-option>
    </el-select>
  </div>

  <el-dialog
    v-model="showDeleteDialog"
    title="确认删除"
    width="400px"
  >
    <span>确定要删除项目"{{ projectToDelete?.title }}"吗？此操作将删除项目及其所有关联数据（对话、时间线、角色等）。</span>
    <template #footer>
      <el-button @click="showDeleteDialog = false">取消</el-button>
      <el-button type="danger" @click="handleDeleteConfirm">删除</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { Delete } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '../stores/projectStore';

const projectStore = useProjectStore();
const { projects, currentProject } = storeToRefs(projectStore);
const { selectProject, deleteProject } = projectStore;

const selectedProjectId = ref(currentProject.value?.id || '');
const showDeleteDialog = ref(false);
const deleteProjectId = ref<string | null>(null);

const projectToDelete = computed(() => {
  if (!deleteProjectId.value) return null;
  return projects.value.find(p => p.id === deleteProjectId.value) || null;
});

watch(
  () => selectedProjectId.value,
  (newId) => {
    selectProject(newId);
  }
);

watch(
  () => currentProject.value?.id,
  (newId) => {
    if (newId) {
      selectedProjectId.value = newId;
    }
  }
);

const handleDeleteProject = (id: string) => {
  deleteProjectId.value = id;
  showDeleteDialog.value = true;
};

const handleDeleteConfirm = async () => {
  if (!deleteProjectId.value) return;

  try {
    await deleteProject(deleteProjectId.value);
    ElMessage.success('项目删除成功');
    showDeleteDialog.value = false;
    deleteProjectId.value = null;
  } catch (error) {
    console.error('Failed to delete project:', error);
    ElMessage.error('删除项目失败');
  }
};
</script>
