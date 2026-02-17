import { create } from 'zustand';
import { TimelineNode } from '../../shared/types';
import { ipcClient } from '../utils/ipc';

interface TimelineState {
  nodes: TimelineNode[];
  selectedNode: TimelineNode | null;
  isLoading: boolean;
  
  loadNodes: (projectId: string) => Promise<void>;
  createNode: (title: string, date: string, description?: string) => Promise<TimelineNode>;
  updateNode: (id: string, updates: Partial<TimelineNode>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  selectNode: (id: string | null) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  nodes: [],
  selectedNode: null,
  isLoading: false,

  loadNodes: async (projectId: string) => {
    set({ isLoading: true });
    try {
      const nodes = await ipcClient.timeline.getAll(projectId);
      set({ nodes, isLoading: false });
    } catch (error) {
      console.error('Failed to load timeline nodes:', error);
      set({ isLoading: false });
    }
  },

  createNode: async (title: string, date: string, description?: string) => {
    const { currentProject } = useProjectStore.getState();
    if (!currentProject) throw new Error('No project selected');

    const node = await ipcClient.timeline.create(currentProject.id, {
      title,
      date,
      description: description || '',
    });
    
    set(state => ({
      nodes: [...state.nodes, node],
      selectedNode: node,
    }));
    
    return node;
  },

  updateNode: async (id: string, updates: Partial<TimelineNode>) => {
    await ipcClient.timeline.update(id, updates);
    set(state => ({
      nodes: state.nodes.map(n => (n.id === id ? { ...n, ...updates } : n)),
      selectedNode: state.selectedNode?.id === id ? { ...state.selectedNode, ...updates } : state.selectedNode,
    }));
  },

  deleteNode: (id: string) => {
    ipcClient.timeline.delete(id);
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
