import { create } from 'zustand';
import { Project } from '../../shared/types';
import { ipcClient } from '../utils/ipc';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  loadProjects: () => Promise<void>;
  createProject: (title: string, description?: string) => Promise<Project>;
  selectProject: (id: string | null) => void;
  updateProject: (updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await ipcClient.project.getAll();
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
    const project = await ipcClient.project.create(title, description);
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

    const updated = await ipcClient.project.update(currentProject.id, updates);
    set(state => ({
      projects: state.projects.map(p => p.id === updated.id ? updated : p),
      currentProject: updated,
    }));
  },

  deleteProject: async (id: string) => {
    await ipcClient.project.delete(id);
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
  },
}));
