import { create } from 'zustand';
import { Character } from '../../shared/types';
import { ipcClient } from '../utils/ipc';

interface CharacterState {
  characters: Character[];
  selectedCharacters: Set<string>;
  isLoading: boolean;
  
  loadCharacters: (projectId: string) => Promise<void>;
  createCharacter: (character: Omit<Character, 'id' | 'projectId' | 'createdAt'>) => Promise<Character>;
  updateCharacter: (id: string, updates: Partial<Character>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  toggleCharacterSelection: (id: string) => void;
  clearCharacterSelection: () => void;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  selectedCharacters: new Set<string>(),
  isLoading: false,

  loadCharacters: async (projectId: string) => {
    set({ isLoading: true });
    try {
      const characters = await ipcClient.character.getAll(projectId);
      set({ characters, isLoading: false });
    } catch (error) {
      console.error('Failed to load characters:', error);
      set({ isLoading: false });
    }
  },

  createCharacter: async (character) => {
    const { currentProject } = useProjectStore.getState();
    if (!currentProject) throw new Error('No project selected');

    const newCharacter = await ipcClient.character.create(currentProject.id, character);
    set(state => ({ characters: [...state.characters, newCharacter] }));
    return newCharacter;
  },

  updateCharacter: async (id: string, updates: Partial<Character>) => {
    await ipcClient.character.update(id, updates);
    set(state => ({
      characters: state.characters.map(c => (c.id === id ? { ...c, ...updates } : c)),
    }));
  },

  deleteCharacter: (id: string) => {
    ipcClient.character.delete(id);
    set(state => ({
      characters: state.characters.filter(c => c.id !== id),
      selectedCharacters: new Set([...state.selectedCharacters].filter(sid => sid !== id)),
    }));
  },

  toggleCharacterSelection: (id: string) => {
    set(state => {
      const newSelected = new Set(state.selectedCharacters);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedCharacters: newSelected };
    });
  },

  clearCharacterSelection: () => {
    set({ selectedCharacters: new Set<string>() });
  },
}));
