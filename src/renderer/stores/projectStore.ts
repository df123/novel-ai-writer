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

      if (projects.value.length > 0) {
        if (!currentProject.value) {
          currentProject.value = projects.value[0];
        } else {
          const updated = projects.value.find(p => p.id === currentProject.value?.id);
          if (updated) {
            currentProject.value = updated;
          } else {
            currentProject.value = projects.value[0];
          }
        }
      } else {
        currentProject.value = null;
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const createProject = async (title: string, description?: string) => {
    try {
      const response = await projectApi.create({ title, description });
      const project = response.data;
      projects.value.unshift(project);
      currentProject.value = project;
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  const selectProject = (id: string | null) => {
    if (!id) {
      currentProject.value = null;
      return;
    }

    const project = projects.value.find(p => p.id === id);
    if (project) {
      currentProject.value = project;
    } else {
      console.warn(`Project with id ${id} not found`);
    }
  };

  const updateProject = async (updates: { title?: string; description?: string }) => {
    if (!currentProject.value) return;

    try {
      const response = await projectApi.update(currentProject.value.id, {
        title: updates.title ?? currentProject.value.title,
        description: updates.description ?? currentProject.value.description,
      });
      const updated = response.data;

      projects.value = projects.value.map(p => p.id === updated.id ? updated : p);
      currentProject.value = updated;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await projectApi.delete(id);
      projects.value = projects.value.filter(p => p.id !== id);
      if (currentProject.value?.id === id) {
        currentProject.value = projects.value.length > 0 ? projects.value[0] : null;
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  };

  const exportProject = async (format: 'md' | 'txt') => {
    if (!currentProject.value) throw new Error('No project selected');

    try {
      const response = await projectApi.export(currentProject.value.id, format);
      return response.data;
    } catch (error) {
      console.error('Failed to export project:', error);
      throw error;
    }
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
