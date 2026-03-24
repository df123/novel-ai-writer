import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Theme, ThemeHistory, CreateThemeRequest, UpdateThemeRequest } from '@shared/types';
import { themeApi } from '../utils/api';

export const useThemeStore = defineStore('theme', () => {
  // 状态
  const themes = ref<Theme[]>([]);
  const currentTheme = ref<Theme | null>(null);
  const trashThemes = ref<Theme[]>([]);
  const themeHistory = ref<ThemeHistory[]>([]);
  const isLoading = ref(false);

  // 加载项目的主旨列表
  const loadThemes = async (projectId: string) => {
    isLoading.value = true;
    try {
      const response = await themeApi.list(projectId);
      themes.value = response.data;
    } catch (error) {
      console.error('加载主旨列表失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // 加载当前主旨（最新版本）
  const loadCurrentTheme = async (projectId: string) => {
    isLoading.value = true;
    try {
      const response = await themeApi.getCurrent(projectId);
      currentTheme.value = response.data;
      return response.data;
    } catch (error) {
      console.error('加载当前主旨失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // 加载回收站主旨列表
  const loadTrashThemes = async (projectId: string) => {
    isLoading.value = true;
    try {
      const response = await themeApi.getTrash(projectId);
      trashThemes.value = response.data;
    } catch (error) {
      console.error('加载回收站主旨列表失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // 创建新主旨
  const createTheme = async (projectId: string, data: CreateThemeRequest) => {
    try {
      const response = await themeApi.create(projectId, data);
      // 重新加载主旨列表和当前主旨
      await loadThemes(projectId);
      await loadCurrentTheme(projectId);
      return response.data;
    } catch (error) {
      console.error('创建主旨失败:', error);
      throw error;
    }
  };

  // 更新主旨
  const updateTheme = async (id: string, data: UpdateThemeRequest) => {
    try {
      const response = await themeApi.update(id, data);
      const updatedTheme = response.data;
      // 更新本地状态中的主旨
      const index = themes.value.findIndex(t => t.id === id);
      if (index !== -1) {
        themes.value[index] = updatedTheme;
      }
      // 如果更新的是当前主旨，也更新当前主旨
      if (currentTheme.value && currentTheme.value.id === id) {
        currentTheme.value = updatedTheme;
      }
      return updatedTheme;
    } catch (error) {
      console.error('更新主旨失败:', error);
      throw error;
    }
  };

  // 删除主旨（软删除）
  const deleteTheme = async (id: string) => {
    try {
      await themeApi.delete(id);
      // 从主旨列表中移除该主旨
      const index = themes.value.findIndex(t => t.id === id);
      if (index !== -1) {
        themes.value.splice(index, 1);
      }
      // 如果删除的是当前主旨，清空当前主旨
      if (currentTheme.value && currentTheme.value.id === id) {
        currentTheme.value = null;
      }
    } catch (error) {
      console.error('删除主旨失败:', error);
      throw error;
    }
  };

  // 恢复主旨
  const restoreTheme = async (id: string) => {
    try {
      const response = await themeApi.restore(id);
      const restoredTheme = response.data;
      // 从回收站列表中移除该主旨
      const trashIndex = trashThemes.value.findIndex(t => t.id === id);
      if (trashIndex !== -1) {
        trashThemes.value.splice(trashIndex, 1);
      }
      // 添加到主旨列表
      themes.value.push(restoredTheme);
      return restoredTheme;
    } catch (error) {
      console.error('恢复主旨失败:', error);
      throw error;
    }
  };

  // 永久删除主旨
  const permanentDeleteTheme = async (id: string) => {
    try {
      await themeApi.permanentDelete(id);
      // 从回收站列表中移除该主旨
      const index = trashThemes.value.findIndex(t => t.id === id);
      if (index !== -1) {
        trashThemes.value.splice(index, 1);
      }
    } catch (error) {
      console.error('永久删除主旨失败:', error);
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

  // 清空主旨列表（切换项目时）
  const clearThemes = () => {
    themes.value = [];
    currentTheme.value = null;
    trashThemes.value = [];
    themeHistory.value = [];
  };

  return {
    // 状态
    themes,
    currentTheme,
    trashThemes,
    themeHistory,
    isLoading,

    // Actions
    loadThemes,
    loadCurrentTheme,
    loadTrashThemes,
    createTheme,
    updateTheme,
    deleteTheme,
    restoreTheme,
    permanentDeleteTheme,
    loadThemeHistory,
    loadHistoryVersion,
    clearThemes,
  };
});
