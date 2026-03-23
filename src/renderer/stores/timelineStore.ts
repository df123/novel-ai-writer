import { defineStore } from 'pinia';
import { ref } from 'vue';
import { TimelineNode, TimelineNodeVersion } from '../../shared/types';
import { timelineApi } from '../utils/api';
import { useProjectStore } from './projectStore';

export const useTimelineStore = defineStore('timeline', () => {
  const nodes = ref<TimelineNode[]>([]);
  const selectedNode = ref<TimelineNode | null>(null);
  const isLoading = ref(false);
  const versions = ref<Map<string, TimelineNodeVersion[]>>(new Map());
  const isLoadingVersions = ref(false);

  const loadNodes = async (projectId: string) => {
    isLoading.value = true;
    try {
      const response = await timelineApi.list(projectId);
      nodes.value = response.data;
    } catch (error) {
      console.error('Failed to load timeline nodes:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const createNode = async (title: string, content?: string, options?: { date?: string }) => {
    const projectStore = useProjectStore();
    if (!projectStore.currentProject) throw new Error('No project selected');

    try {
      const orderIndex = nodes.value.length > 0 ? Math.max(...nodes.value.map(n => n.orderIndex)) + 1 : 0;
      const response = await timelineApi.create(projectStore.currentProject.id, {
        title,
        date: options?.date,
        content: content ?? '',
        orderIndex,
      });
      const node = response.data;

      nodes.value.push(node);
      selectedNode.value = node;

      return node;
    } catch (error) {
      console.error('Failed to create timeline node:', error);
      throw error;
    }
  };

  const updateNode = async (id: string, updates: Partial<TimelineNode> & { createVersion?: boolean }) => {
    const node = nodes.value.find(n => n.id === id);
    if (!node) return;

    try {
      const response = await timelineApi.update(id, {
        title: updates.title ?? node.title,
        date: updates.date ?? node.date,
        content: updates.content ?? (node.content ?? ''),
        orderIndex: updates.orderIndex ?? node.orderIndex,
        createVersion: updates.createVersion,
      });

      nodes.value = nodes.value.map(n => (n.id === id ? response.data : n));
      if (selectedNode.value?.id === id) {
        selectedNode.value = response.data;
      }
    } catch (error) {
      console.error('Failed to update timeline node:', error);
      throw error;
    }
  };

  const deleteNode = async (id: string) => {
    try {
      await timelineApi.delete(id);
      nodes.value = nodes.value.filter(n => n.id !== id);
      versions.value.delete(id);
      if (selectedNode.value?.id === id) {
        selectedNode.value = null;
      }
    } catch (error) {
      console.error('Failed to delete timeline node:', error);
      throw error;
    }
  };

  const selectNode = (id: string | null) => {
    if (!id) {
      selectedNode.value = null;
      return;
    }

    const node = nodes.value.find(n => n.id === id);
    if (node) {
      selectedNode.value = node;
    }
  };

  const loadVersions = async (nodeId: string) => {
    isLoadingVersions.value = true;
    try {
      const response = await timelineApi.getVersions(nodeId);
      versions.value.set(nodeId, response.data);
    } catch (error) {
      console.error('Failed to load timeline node versions:', error);
    } finally {
      isLoadingVersions.value = false;
    }
  };

  const getVersions = (nodeId: string): TimelineNodeVersion[] => {
    return versions.value.get(nodeId) || [];
  };

  const restoreVersion = async (nodeId: string, versionId: string) => {
    try {
      const response = await timelineApi.restoreVersion(nodeId, versionId);
      const updatedNode = response.data;

      const index = nodes.value.findIndex(n => n.id === nodeId);
      if (index !== -1) {
        nodes.value[index] = updatedNode;
        if (selectedNode.value?.id === nodeId) {
          selectedNode.value = updatedNode;
        }
      }
      return updatedNode;
    } catch (error) {
      console.error('Failed to restore timeline node version:', error);
      throw error;
    }
  };

  return {
    nodes,
    selectedNode,
    isLoading,
    versions,
    isLoadingVersions,
    loadNodes,
    createNode,
    updateNode,
    deleteNode,
    selectNode,
    loadVersions,
    getVersions,
    restoreVersion,
  };
});
