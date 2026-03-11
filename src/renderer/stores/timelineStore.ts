import { defineStore } from 'pinia';
import { ref } from 'vue';
import { TimelineNode } from '../../shared/types';
import { timelineApi } from '../utils/api';
import { useProjectStore } from './projectStore';

export const useTimelineStore = defineStore('timeline', () => {
  const nodes = ref<TimelineNode[]>([]);
  const selectedNode = ref<TimelineNode | null>(null);
  const isLoading = ref(false);

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

  const createNode = async (title: string, content?: string) => {
    const projectStore = useProjectStore();
    if (!projectStore.currentProject) throw new Error('No project selected');

    const orderIndex = nodes.value.length;
    const response = await timelineApi.create(projectStore.currentProject.id, {
      title,
      content: content || '',
      orderIndex,
    });
    const node = response.data;
    
    nodes.value.push(node);
    selectedNode.value = node;
    
    return node;
  };

  const updateNode = async (id: string, updates: Partial<TimelineNode>) => {
    const node = nodes.value.find(n => n.id === id);
    if (!node) return;

    const response = await timelineApi.update(id, {
      title: updates.title || node.title,
      content: (updates as any).content || (node as any).content,
      orderIndex: updates.orderIndex || node.orderIndex,
    });

    nodes.value = nodes.value.map(n => (n.id === id ? response.data : n));
    if (selectedNode.value?.id === id) {
      selectedNode.value = response.data;
    }
  };

  const deleteNode = async (id: string) => {
    await timelineApi.delete(id);
    nodes.value = nodes.value.filter(n => n.id !== id);
    if (selectedNode.value?.id === id) {
      selectedNode.value = null;
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

  return {
    nodes,
    selectedNode,
    isLoading,
    loadNodes,
    createNode,
    updateNode,
    deleteNode,
    selectNode,
  };
});
