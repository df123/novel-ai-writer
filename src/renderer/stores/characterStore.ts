import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Character } from '../../shared/types';
import { characterApi } from '../utils/api';
import { useProjectStore } from './projectStore';

export const useCharacterStore = defineStore('character', () => {
  const characters = ref<Character[]>([]);
  const selectedCharacters = ref<Set<string>>(new Set());
  const isLoading = ref(false);

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

    const response = await characterApi.create(projectStore.currentProject.id, character);
    const newCharacter = response.data;
    characters.value.push(newCharacter);
    return newCharacter;
  };

  const updateCharacter = async (id: string, updates: Partial<Character>) => {
    const response = await characterApi.update(id, updates);
    const updated = response.data;
    characters.value = characters.value.map(c => (c.id === id ? updated : c));
  };

  const deleteCharacter = async (id: string) => {
    await characterApi.delete(id);
    characters.value = characters.value.filter(c => c.id !== id);
    const newSelected = new Set(selectedCharacters.value);
    newSelected.delete(id);
    selectedCharacters.value = newSelected;
  };

  const toggleCharacterSelection = (id: string) => {
    const newSelected = new Set(selectedCharacters.value);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    selectedCharacters.value = newSelected;
  };

  const clearCharacterSelection = () => {
    selectedCharacters.value = new Set<string>();
  };

  return {
    characters,
    selectedCharacters,
    isLoading,
    loadCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    toggleCharacterSelection,
    clearCharacterSelection,
  };
});
