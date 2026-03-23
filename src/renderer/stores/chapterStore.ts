import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { chapterApi } from '../utils/api';
import type { Chapter } from '@shared/types';

export const useChapterStore = defineStore('chapter', () => {
  // 状态
  const chapters = ref<Chapter[]>([]);
  const currentChapter = ref<Chapter | null>(null);
  const isLoading = ref(false);
  const isTrashMode = ref(false);

  // 计算属性
  const activeChapters = computed(() =>
    chapters.value.filter(ch => !ch.deleted)
  );

  const deletedChapters = computed(() =>
    chapters.value.filter(ch => ch.deleted)
  );

  const sortedChapters = computed(() =>
    [...activeChapters.value].sort((a, b) => a.chapterNumber - b.chapterNumber)
  );

  // Actions
  async function loadChapters(projectId: string) {
    isLoading.value = true;
    try {
      const response = await chapterApi.list(projectId);
      chapters.value = response.data;
    } catch (error) {
      console.error('加载章节失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadChapter(projectId: string, chapterId: string) {
    isLoading.value = true;
    try {
      const response = await chapterApi.get(projectId, chapterId);
      currentChapter.value = response.data;
      return response.data;
    } catch (error) {
      console.error('加载章节失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function createChapter(projectId: string, data: { chapterNumber: number; title: string; content: string; sourceMessageId?: string }) {
    try {
      const response = await chapterApi.create(projectId, data);
      chapters.value.push(response.data);
      return response.data;
    } catch (error) {
      console.error('创建章节失败:', error);
      throw error;
    }
  }

  async function updateChapter(projectId: string, chapterId: string, data: { title?: string; chapterNumber?: number }) {
    try {
      const response = await chapterApi.update(projectId, chapterId, data);
      const index = chapters.value.findIndex(ch => ch.id === chapterId);
      if (index === -1) {
        console.warn(`章节 ${chapterId} 在本地状态中未找到`);
      }
      if (index !== -1 && response.data) {
        chapters.value[index] = response.data;
      }
      return response.data;
    } catch (error) {
      console.error('更新章节失败:', error);
      throw error;
    }
  }

  async function deleteChapter(projectId: string, chapterId: string) {
    try {
      await chapterApi.delete(projectId, chapterId);
      const index = chapters.value.findIndex(ch => ch.id === chapterId);
      if (index !== -1) {
        // 更新章节的删除标记，而不是从数组中移除
        chapters.value[index] = { ...chapters.value[index], deleted: true, deletedAt: Date.now() / 1000 };
      }
    } catch (error) {
      console.error('删除章节失败:', error);
      throw error;
    }
  }

  async function restoreChapter(projectId: string, chapterId: string) {
    try {
      const response = await chapterApi.restore(projectId, chapterId);
      const index = chapters.value.findIndex(ch => ch.id === chapterId);
      if (index !== -1) {
        // 更新章节的删除标记，而不是从trashChapters移除并添加到chapters
        chapters.value[index] = { ...response.data, deleted: false, deletedAt: undefined };
      }
      return response.data;
    } catch (error) {
      console.error('恢复章节失败:', error);
      throw error;
    }
  }

  async function permanentDeleteChapter(projectId: string, chapterId: string) {
    try {
      await chapterApi.permanentDelete(projectId, chapterId);
      const index = chapters.value.findIndex(ch => ch.id === chapterId);
      if (index !== -1) {
        // 从chapters数组中永久删除
        chapters.value.splice(index, 1);
      }
    } catch (error) {
      console.error('永久删除章节失败:', error);
      throw error;
    }
  }

  async function updateChapterOrder(projectId: string, data: { chapters: Array<{ id: string; chapterNumber: number }> }) {
    try {
      await chapterApi.updateOrder(projectId, data);
      // 重新加载章节列表
      await loadChapters(projectId);
    } catch (error) {
      console.error('更新章节排序失败:', error);
      throw error;
    }
  }

  async function exportChapters(projectId: string, format: 'txt' | 'md' = 'txt') {
    try {
      const response = await chapterApi.export(projectId, format);
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `novel_chapters.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出章节失败:', error);
      throw error;
    }
  }

  async function loadTrashChapters(projectId: string) {
    isLoading.value = true;
    try {
      const response = await chapterApi.getTrash(projectId);
      // 将已删除的章节合并到chapters数组中
      for (const deletedChapter of response.data) {
        const existingIndex = chapters.value.findIndex(ch => ch.id === deletedChapter.id);
        if (existingIndex !== -1) {
          // 更新现有章节
          chapters.value[existingIndex] = deletedChapter;
        } else {
          // 添加新章节
          chapters.value.push(deletedChapter);
        }
      }
    } catch (error) {
      console.error('加载回收站失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function emptyTrash(projectId: string) {
    try {
      await chapterApi.emptyTrash(projectId);
      // 从chapters数组中移除所有已删除的章节
      chapters.value = chapters.value.filter(ch => !ch.deleted);
    } catch (error) {
      console.error('清空回收站失败:', error);
      throw error;
    }
  }

  function setCurrentChapter(chapter: Chapter | null) {
    currentChapter.value = chapter;
  }

  function toggleTrashMode() {
    isTrashMode.value = !isTrashMode.value;
  }

  return {
    // 状态
    chapters,
    currentChapter,
    isLoading,
    isTrashMode,

    // 计算属性
    activeChapters,
    deletedChapters,
    sortedChapters,

    // Actions
    loadChapters,
    loadChapter,
    createChapter,
    updateChapter,
    deleteChapter,
    restoreChapter,
    permanentDeleteChapter,
    updateChapterOrder,
    exportChapters,
    loadTrashChapters,
    emptyTrash,
    setCurrentChapter,
    toggleTrashMode
  };
});
