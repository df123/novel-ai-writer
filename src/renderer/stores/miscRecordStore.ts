import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { MiscRecord, MiscRecordVersion } from '../../shared/types';
import { miscRecordApi } from '../utils/api';

export const useMiscRecordStore = defineStore('miscRecord', () => {
  const records = ref<MiscRecord[]>([]);
  const selectedRecord = ref<MiscRecord | null>(null);
  const isLoading = ref(false);
  const versions = ref<Map<string, MiscRecordVersion[]>>(new Map());
  const isLoadingVersions = ref(false);
  const searchQuery = ref('');
  const selectedCategory = ref('');

  // 从记录列表中提取所有不重复的分类，排序后返回
  const categories = computed(() => {
    const categorySet = new Set(records.value.map(r => r.category));
    return Array.from(categorySet).sort();
  });

  const loadRecords = async (projectId: string) => {
    isLoading.value = true;
    try {
      const response = await miscRecordApi.list(projectId, {
        search: searchQuery.value || undefined,
        category: selectedCategory.value || undefined,
      });
      records.value = response.data;
    } catch (error) {
      console.error('加载杂物记录失败:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const createRecord = async (projectId: string, data: { title: string; category?: string; content?: string }) => {
    try {
      const response = await miscRecordApi.create(projectId, data);
      const newRecord = response.data;
      records.value.push(newRecord);
      return newRecord;
    } catch (error) {
      console.error('创建杂物记录失败:', error);
      throw error;
    }
  };

  const updateRecord = async (id: string, data: { title?: string; category?: string; content?: string }) => {
    try {
      const response = await miscRecordApi.update(id, {
        ...data,
        createVersion: true,
      });
      const updated = response.data;
      records.value = records.value.map(r => (r.id === id ? updated : r));
    } catch (error) {
      console.error('更新杂物记录失败:', error);
      throw error;
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      await miscRecordApi.delete(id);
      records.value = records.value.filter(r => r.id !== id);
      versions.value.delete(id);
    } catch (error) {
      console.error('删除杂物记录失败:', error);
      throw error;
    }
  };

  const selectRecord = (record: MiscRecord | null) => {
    selectedRecord.value = record;
  };

  const loadVersions = async (recordId: string) => {
    isLoadingVersions.value = true;
    try {
      const response = await miscRecordApi.getVersions(recordId);
      versions.value.set(recordId, response.data);
    } catch (error) {
      console.error('加载杂物记录版本失败:', error);
    } finally {
      isLoadingVersions.value = false;
    }
  };

  const getVersions = (recordId: string): MiscRecordVersion[] => {
    return versions.value.get(recordId) || [];
  };

  const restoreVersion = async (recordId: string, versionId: string) => {
    try {
      const response = await miscRecordApi.restoreVersion(recordId, versionId);
      const updatedRecord = response.data;

      const index = records.value.findIndex(r => r.id === recordId);
      if (index !== -1) {
        records.value[index] = updatedRecord;
      }
      return updatedRecord;
    } catch (error) {
      console.error('恢复杂物记录版本失败:', error);
      throw error;
    }
  };

  const restoreRecord = async (id: string) => {
    try {
      const response = await miscRecordApi.restore(id);
      const restored = response.data;
      records.value.push(restored);
      return restored;
    } catch (error) {
      console.error('恢复杂物记录失败:', error);
      throw error;
    }
  };

  const permanentDelete = async (id: string) => {
    try {
      await miscRecordApi.permanentDelete(id);
      records.value = records.value.filter(r => r.id !== id);
      versions.value.delete(id);
    } catch (error) {
      console.error('永久删除杂物记录失败:', error);
      throw error;
    }
  };

  const loadTrash = async (projectId: string) => {
    isLoading.value = true;
    try {
      const response = await miscRecordApi.getTrash(projectId);
      records.value = response.data;
    } catch (error) {
      console.error('加载回收站失败:', error);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    records,
    selectedRecord,
    isLoading,
    versions,
    isLoadingVersions,
    searchQuery,
    selectedCategory,
    categories,
    loadRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    selectRecord,
    loadVersions,
    getVersions,
    restoreVersion,
    restoreRecord,
    permanentDelete,
    loadTrash,
  };
});
