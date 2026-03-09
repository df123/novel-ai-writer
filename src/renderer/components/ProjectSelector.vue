<template>
  <div v-if="projects.length > 0" style="min-width: 200px; margin-left: 8px">
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
      />
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '../stores/projectStore';

const projectStore = useProjectStore();
const { projects, currentProject } = storeToRefs(projectStore);
const { selectProject } = projectStore;

const selectedProjectId = ref(currentProject.value?.id || '');

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
</script>
