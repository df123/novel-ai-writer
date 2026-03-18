<template>
  <div v-if="isReady">
    <MainLayout />
    <WelcomeDialog />
  </div>
  <div v-else class="loading-container">
    <div class="loading-text">加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProjectStore } from './stores/projectStore';
import { useSettingsStore } from './stores/settingsStore';
import MainLayout from './components/MainLayout.vue';
import WelcomeDialog from './components/WelcomeDialog.vue';

const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const isReady = ref(false);

onMounted(async () => {
  try {
    await Promise.all([projectStore.loadProjects(), settingsStore.loadSettings()]);
    isReady.value = true;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    isReady.value = true;
  }
});
</script>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.loading-text {
  margin-top: 20px;
}
</style>
