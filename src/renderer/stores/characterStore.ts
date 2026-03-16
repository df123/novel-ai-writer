import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Character, CharacterVersion } from '../../shared/types';
import { characterApi } from '../utils/api';
import { useProjectStore } from './projectStore';

export const useCharacterStore = defineStore('character', () => {
  const characters = ref<Character[]>([]);
  const selectedCharacters = ref<Set<string>>(new Set());
  const isLoading = ref(false);
  const versions = ref<Map<string, CharacterVersion[]>>(new Map());
  const isLoadingVersions = ref(false);

  const loadCharacters = async (projectId: string) => {
    isLoading.value = true;
    try {
      const response = await characterApi.list(projectId);
      characters.value = response.data;
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const createCharacter = async (character: Omit<Character, 'id' | 'projectId' | 'createdAt'>) => {
    const projectStore = useProjectStore();
    if (!projectStore.currentProject) throw new Error('No project selected');

    try {
      const response = await characterApi.create(projectStore.currentProject.id, character);
      const newCharacter = response.data;
      characters.value.push(newCharacter);
      return newCharacter;
    } catch (error) {
      console.error('Failed to create character:', error);
      throw error;
    }
  };

  const updateCharacter = async (id: string, updates: Partial<Character> & { createVersion?: boolean }) => {
    try {
      const response = await characterApi.update(id, updates);
      const updated = response.data;
      characters.value = characters.value.map(c => (c.id === id ? updated : c));
    } catch (error) {
      console.error('Failed to update character:', error);
      throw error;
    }
  };

  const deleteCharacter = async (id: string) => {
    try {
      await characterApi.delete(id);
      characters.value = characters.value.filter(c => c.id !== id);
      selectedCharacters.value.delete(id);
      versions.value.delete(id);
    } catch (error) {
      console.error('Failed to delete character:', error);
      throw error;
    }
  };

  const toggleCharacterSelection = (id: string) => {
    if (selectedCharacters.value.has(id)) {
      selectedCharacters.value.delete(id);
    } else {
      selectedCharacters.value.add(id);
    }
  };

  const clearCharacterSelection = () => {
    selectedCharacters.value.clear();
  };

  const loadVersions = async (characterId: string) => {
    isLoadingVersions.value = true;
    try {
      const response = await characterApi.getVersions(characterId);
      versions.value.set(characterId, response.data);
    } catch (error) {
      console.error('Failed to load character versions:', error);
    } finally {
      isLoadingVersions.value = false;
    }
  };

  const getVersions = (characterId: string): CharacterVersion[] => {
    return versions.value.get(characterId) || [];
  };

  const restoreVersion = async (characterId: string, versionId: string) => {
    try {
      const response = await characterApi.restoreVersion(characterId, versionId);
      const updatedCharacter = response.data;

      const index = characters.value.findIndex(c => c.id === characterId);
      if (index !== -1) {
        characters.value[index] = updatedCharacter;
      }
      return updatedCharacter;
    } catch (error) {
      console.error('Failed to restore character version:', error);
      throw error;
    }
  };

  return {
    characters,
    selectedCharacters,
    isLoading,
    versions,
    isLoadingVersions,
    loadCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    toggleCharacterSelection,
    clearCharacterSelection,
    loadVersions,
    getVersions,
    restoreVersion,
  };
});
