import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { webSecurity } from '../utils/api';

interface SessionResponse {
  authenticated: boolean;
  appMode: 'local' | 'public';
  csrfToken?: string | null;
  expiresAt?: number | null;
}

interface LoginResponse extends SessionResponse {
  username?: string;
}

/**
 * Web 认证状态（public 模式）：
 * 启动时先探测会话，未认证渲染 LoginView；登录后持有 CSRF 令牌供 axios/fetch 统一带上
 */
export const useAuthStore = defineStore('auth', () => {
  const appMode = ref<'local' | 'public'>('local');
  const authenticated = ref(true);
  const csrfToken = ref<string | null>(null);
  const expiresAt = ref<number | null>(null);
  const isReady = ref(false);
  const loginError = ref('');
  const isLoggingIn = ref(false);

  function applySession(session: SessionResponse): void {
    appMode.value = session.appMode;
    authenticated.value = session.authenticated;
    csrfToken.value = session.csrfToken ?? null;
    expiresAt.value = session.expiresAt ?? null;
    webSecurity.configure({
      appMode: session.appMode,
      csrfToken: session.csrfToken ?? null,
      onUnauthorized: () => {
        authenticated.value = false;
        csrfToken.value = null;
        webSecurity.configure({ csrfToken: null });
      }
    });
  }

  // SPA 启动第一步：先探测会话，再决定加载应用还是登录页（设计书 §14）
  async function initSession(): Promise<void> {
    try {
      const response = await axios.get<SessionResponse>('/api/auth/session');
      applySession(response.data);
    } catch (error) {
      console.error('Failed to probe auth session:', error);
      // 探测失败按未认证处理，公网模式下展示登录页
      authenticated.value = false;
    } finally {
      isReady.value = true;
    }
  }

  async function login(username: string, password: string): Promise<boolean> {
    loginError.value = '';
    isLoggingIn.value = true;
    try {
      const response = await axios.post<LoginResponse>('/api/auth/login', { username, password });
      applySession({ ...response.data, authenticated: true });
      return true;
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      loginError.value = message || '登录失败，请稍后再试';
      return false;
    } finally {
      isLoggingIn.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
    authenticated.value = false;
    csrfToken.value = null;
    webSecurity.configure({ csrfToken: null });
  }

  return {
    appMode,
    authenticated,
    csrfToken,
    expiresAt,
    isReady,
    loginError,
    isLoggingIn,
    initSession,
    login,
    logout
  };
});
