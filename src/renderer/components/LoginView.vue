<template>
  <div class="login-view">
    <el-card class="login-card">
      <h2 class="login-title">Novel Writer 登录</h2>
      <el-form @submit.prevent="handleLogin">
        <el-form-item>
          <el-input v-model="username" placeholder="用户名" size="large" autocomplete="username" :disabled="authStore.isLoggingIn" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" type="password" placeholder="密码" size="large" show-password
            autocomplete="current-password" :disabled="authStore.isLoggingIn" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-alert v-if="authStore.loginError" :title="authStore.loginError" type="error" show-icon :closable="false" class="login-error" />
        <el-button type="primary" size="large" class="login-button" :loading="authStore.isLoggingIn" @click="handleLogin">
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
const username = ref('');
const password = ref('');

const handleLogin = async () => {
  if (!username.value || !password.value || authStore.isLoggingIn) return;
  const ok = await authStore.login(username.value, password.value);
  if (ok) {
    // 密码不留在组件状态
    password.value = '';
  }
};
</script>

<style scoped>
.login-view {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--el-bg-color-page, #f2f3f5);
}

.login-card {
  width: 360px;
}

.login-title {
  margin: 0 0 20px;
  text-align: center;
}

.login-error {
  margin-bottom: 12px;
}

.login-button {
  width: 100%;
}
</style>
