import { create } from 'zustand';
import { Project } from '../../shared/types';
import { projectApi } from '../utils/api';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  loadProjects: () => Promise<void>;
  createProject: (title: string, description?: string) => Promise<Project>;
  selectProject: (id: string | null) => void;
  updateProject: (updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  exportProject: (format: 'md' | 'txt') => Promise<{ content: string }>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const response = await projectApi.list();
      const projects = response.data;
      set({ projects, isLoading: false });
      
      if (projects.length > 0 && !get().currentProject) {
        set({ currentProject: projects[0] });
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      set({ isLoading: false });
    }
  },

  createProject: async (title: string, description?: string) => {
    const response = await projectApi.create({ title, description });
    const project = response.data;
    set(state => ({
      projects: [project, ...state.projects],
      currentProject: project,
    }));
    return project;
  },

  selectProject: (id: string | null) => {
    if (!id) {
      set({ currentProject: null });
      return;
    }
    
    const project = get().projects.find(p => p.id === id);
    if (project) {
      set({ currentProject: project });
    }
  },

  updateProject: async (updates: Partial<Project>) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const response = await projectApi.update(currentProject.id, {
      title: updates.title,
      description: updates.description,
    });
    const updated = response.data;
    set(state => ({
      projects: state.projects.map(p => p.id === updated.id ? updated : p),
      currentProject: updated,
    }));
  },

  deleteProject: async (id: string) => {
    await projectApi.delete(id);
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
  },

  exportProject: async (format: 'md' | 'txt') => {
    const { currentProject } = get();
    if (!currentProject) throw new Error('No project selected');
    
    const response = await projectApi.export(currentProject.id, format);
    return response.data;
  },
}));
