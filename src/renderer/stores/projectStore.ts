import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Project } from '../../shared/types';
import { projectApi } from '../utils/api';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]);
  const currentProject = ref<Project | null>(null);
  const isLoading = ref(false);

  const loadProjects = async () => {
    isLoading.value = true;
    try {
      const response = await projectApi.list();
      projects.value = response.data;
      
      if (projects.value.length > 0 && !currentProject.value) {
        currentProject.value = projects.value[0];
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const createProject = async (title: string, description?: string) => {
    const response = await projectApi.create({ title, description });
    const project = response.data;
    projects.value.unshift(project);
    currentProject.value = project;
    return project;
  };

  const selectProject = (id: string | null) => {
    if (!id) {
      currentProject.value = null;
      return;
    }
    
    const project = projects.value.find(p => p.id === id);
    if (project) {
      currentProject.value = project;
    }
  };

  const updateProject = async (updates: Partial<Project>) => {
    if (!currentProject.value) return;

    const response = await projectApi.update(currentProject.value.id, {
      title: updates.title ?? currentProject.value.title,
      description: updates.description ?? currentProject.value.description,
    });
    const updated = response.data;
    
    projects.value = projects.value.map(p => p.id === updated.id ? updated : p);
    currentProject.value = updated;
  };

  const deleteProject = async (id: string) => {
    await projectApi.delete(id);
    projects.value = projects.value.filter(p => p.id !== id);
    if (currentProject.value?.id === id) {
      currentProject.value = null;
    }
  };

  const exportProject = async (format: 'md' | 'txt') => {
    if (!currentProject.value) throw new Error('No project selected');
    
    const response = await projectApi.export(currentProject.value.id, format);
    return response.data;
  };

  return {
    projects,
    currentProject,
    isLoading,
    loadProjects,
    createProject,
    selectProject,
    updateProject,
    deleteProject,
    exportProject,
  };
});
