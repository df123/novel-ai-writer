import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Theme, ThemeHistory, CreateThemeRequest, UpdateThemeRequest } from '@shared/types';
import { themeApi } from '../utils/api';

export const useThemeStore = defineStore('theme', () => {
  // 状态
  const theme = ref<Theme | null>(null);
  const themeHistory = ref<ThemeHistory[]>([]);
  const isLoading = ref(false);

  // 加载项目的主旨（每个项目只有一个主旨）
  const loadTheme = async (projectId: string) => {
    isLoading.value = true;
    try {
      const response = await themeApi.list(projectId);
      theme.value = response.data;
      return response.data;
    } catch (error) {
      console.error('加载主旨失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // 创建或更新项目主旨
  const saveTheme = async (projectId: string, data: CreateThemeRequest) => {
    try {
      const response = await themeApi.create(projectId, data);
      theme.value = response.data;
      return response.data;
    } catch (error) {
      console.error('保存主旨失败:', error);
      throw error;
    }
  };

  // 更新主旨
  const updateTheme = async (id: string, data: UpdateThemeRequest) => {
    try {
      const response = await themeApi.update(id, data);
      const updatedTheme = response.data;
      // 更新本地状态中的主旨
      if (theme.value && theme.value.id === id) {
        theme.value = updatedTheme;
      }
      return updatedTheme;
    } catch (error) {
      console.error('更新主旨失败:', error);
      throw error;
    }
  };

  // 删除主旨
  const deleteTheme = async (id: string) => {
    try {
      await themeApi.delete(id);
      // 如果删除的是当前主旨，清空主旨
      if (theme.value && theme.value.id === id) {
        theme.value = null;
      }
    } catch (error) {
      console.error('删除主旨失败:', error);
      throw error;
    }
  };

  // 加载主旨历史记录
  const loadThemeHistory = async (id: string) => {
    isLoading.value = true;
    // 清空之前的历史记录
    themeHistory.value = [];
    try {
      const response = await themeApi.getHistory(id);
      themeHistory.value = response.data;
    } catch (error) {
      console.error('加载主旨历史记录失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // 加载指定版本的历史记录
  const loadHistoryVersion = async (id: string, version: number) => {
    isLoading.value = true;
    try {
      const response = await themeApi.getHistoryVersion(id, version);
      return response.data;
    } catch (error) {
      console.error('加载指定版本历史记录失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // 清空主旨（切换项目时）
  const clearTheme = () => {
    theme.value = null;
    themeHistory.value = [];
  };

  return {
    // 状态
    theme,
    themeHistory,
    isLoading,

    // Actions
    loadTheme,
    saveTheme,
    updateTheme,
    deleteTheme,
    loadThemeHistory,
    loadHistoryVersion,
    clearTheme,
  };
});
