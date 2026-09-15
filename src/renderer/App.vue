<template>
  <!-- public 模式未认证 → 登录页（认证通过后再加载应用数据，设计书 §14） -->
  <LoginView v-if="needLogin" />
  <div v-else-if="isReady">
    <MainLayout />
    <WelcomeDialog />
  </div>
  <div v-else class="loading-container">
    <div class="loading-text">加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useProjectStore } from './stores/projectStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAuthStore } from './stores/authStore';
import MainLayout from './components/MainLayout.vue';
import WelcomeDialog from './components/WelcomeDialog.vue';
import LoginView from './components/LoginView.vue';

const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const isReady = ref(false);

const needLogin = computed(() => authStore.isReady && authStore.appMode === 'public' && !authStore.authenticated);

async function loadAppData(): Promise<void> {
  try {
    await Promise.all([projectStore.loadProjects(), settingsStore.loadSettings()]);
  } catch (error) {
    console.error('Failed to initialize app:', error);
  } finally {
    isReady.value = true;
  }
}

onMounted(async () => {
  // 启动门禁：先探测会话，未认证不加载任何业务数据
  await authStore.initSession();
  if (needLogin.value) return;
  await loadAppData();
});

// 登录页完成登录后(未登录时跳过了启动加载)，在此补触发应用数据加载
watch(needLogin, (blocked, wasBlocked) => {
  if (wasBlocked && !blocked && !isReady.value) {
    void loadAppData();
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
