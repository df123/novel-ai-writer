import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * LLM 修改标记的目标实体类型
 */
export type ChangeFlagTarget = 'timeline' | 'character' | 'miscRecord' | 'theme';

const STORAGE_KEY = 'llm-change-flags-v1';

type ProjectChangeFlags = Record<ChangeFlagTarget, string[]>;

function emptyFlags(): ProjectChangeFlags {
  return { timeline: [], character: [], miscRecord: [], theme: [] };
}

function loadAllFromStorage(): Record<string, ProjectChangeFlags> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ProjectChangeFlags>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('读取 LLM 修改标记失败:', error);
    return {};
  }
}

/**
 * 追踪 LLM 工具调用修改过的实体，供界面显示红点提示。
 * 标记按项目隔离并持久化到 localStorage，用户点击查看后清除。
 */
export const useChangeFlagStore = defineStore('changeFlag', () => {
  const projectId = ref<string | null>(null);
  const flags = ref<ProjectChangeFlags>(emptyFlags());

  const persist = () => {
    if (!projectId.value) return;
    try {
      const all = loadAllFromStorage();
      all[projectId.value] = flags.value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (error) {
      console.error('保存 LLM 修改标记失败:', error);
    }
  };

  const switchProject = (id: string | null) => {
    projectId.value = id;
    if (!id) {
      flags.value = emptyFlags();
      return;
    }
    const stored = loadAllFromStorage()[id];
    flags.value = stored ? { ...emptyFlags(), ...stored } : emptyFlags();
  };

  const markChanged = (target: ChangeFlagTarget, id: string) => {
    if (!id || flags.value[target].includes(id)) return;
    flags.value = { ...flags.value, [target]: [...flags.value[target], id] };
    persist();
  };

  const clearFlag = (target: ChangeFlagTarget, id: string) => {
    if (!flags.value[target].includes(id)) return;
    flags.value = { ...flags.value, [target]: flags.value[target].filter(flagId => flagId !== id) };
    persist();
  };

  // 清理已不存在的实体标记（如实体被删除），避免红点计数失真
  const retainOnly = (target: ChangeFlagTarget, existingIds: string[]) => {
    const retained = flags.value[target].filter(id => existingIds.includes(id));
    if (retained.length === flags.value[target].length) return;
    flags.value = { ...flags.value, [target]: retained };
    persist();
  };

  const hasFlag = (target: ChangeFlagTarget, id: string): boolean => {
    return flags.value[target].includes(id);
  };

  const countFlags = (target: ChangeFlagTarget): number => {
    return flags.value[target].length;
  };

  const hasAny = (target: ChangeFlagTarget): boolean => {
    return flags.value[target].length > 0;
  };

  return {
    projectId,
    flags,
    switchProject,
    markChanged,
    clearFlag,
    retainOnly,
    hasFlag,
    countFlags,
    hasAny,
  };
});
