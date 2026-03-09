import { create } from 'zustand';
import { TimelineNode } from '../../shared/types';
import { timelineApi } from '../utils/api';
import { useProjectStore } from './projectStore';

interface TimelineState {
  nodes: TimelineNode[];
  selectedNode: TimelineNode | null;
  isLoading: boolean;
  
  loadNodes: (projectId: string) => Promise<void>;
  createNode: (title: string, content?: string) => Promise<TimelineNode>;
  updateNode: (id: string, updates: Partial<TimelineNode>) => Promise<void>;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  nodes: [],
  selectedNode: null,
  isLoading: false,

  loadNodes: async (projectId: string) => {
    set({ isLoading: true });
    try {
      const response = await timelineApi.list(projectId);
      const nodes = response.data;
      set({ nodes, isLoading: false });
    } catch (error) {
      console.error('Failed to load timeline nodes:', error);
      set({ isLoading: false });
    }
  },

  createNode: async (title: string, content?: string) => {
    const { currentProject } = useProjectStore.getState();
    if (!currentProject) throw new Error('No project selected');

    const orderIndex = get().nodes.length;
    const response = await timelineApi.create(currentProject.id, {
      title,
      content: content || '',
      orderIndex,
    });
    const node = response.data;
    
    set(state => ({
      nodes: [...state.nodes, node],
      selectedNode: node,
    }));
    
    return node;
  },

  updateNode: async (id: string, updates: Partial<TimelineNode>) => {
    const node = get().nodes.find(n => n.id === id);
    if (!node) return;

    const response = await timelineApi.update(id, {
      title: updates.title || node.title,
      content: updates.content || node.content,
      orderIndex: updates.orderIndex || node.orderIndex,
    });
    
    set(state => ({
      nodes: state.nodes.map(n => (n.id === id ? response.data : n)),
      selectedNode: state.selectedNode?.id === id ? response.data : state.selectedNode,
    }));
  },

  deleteNode: async (id: string) => {
    await timelineApi.delete(id);
    set(state => ({
      nodes: state.nodes.filter(n => n.id !== id),
      selectedNode: state.selectedNode?.id === id ? null : state.selectedNode,
    }));
  },

  selectNode: (id: string | null) => {
    if (!id) {
      set({ selectedNode: null });
      return;
    }
    
    const node = get().nodes.find(n => n.id === id);
    if (node) {
      set({ selectedNode: node });
    }
  },
}));
