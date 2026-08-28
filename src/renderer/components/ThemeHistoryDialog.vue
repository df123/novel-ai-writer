<template>
  <el-dialog
    v-model="dialogVisible"
    title="主旨历史记录"
    width="800px"
    :close-on-click-modal="false"
  >
    <div v-if="isLoading" class="loading-container">
      <el-icon class="is-loading" :size="24">
        <Loading />
      </el-icon>
      <div class="loading-text">加载中...</div>
    </div>
    <div v-else-if="historyList.length === 0" class="empty-state">
      暂无历史记录
    </div>
    <div v-else class="history-container">
      <div
        v-for="(history, index) in historyList"
        :key="history.id"
        class="history-item"
        :class="{ 'history-latest': index === 0 }"
      >
        <div class="history-header">
          <div class="history-badge" :class="{ 'latest-badge': index === 0 }">
            <span v-if="index === 0" class="badge-icon">🔥</span>
            v{{ history.version }}
          </div>
          <div class="history-meta">
            <el-tag size="small" type="info">
              {{ formatCreatedBy(history.createdBy) }}
            </el-tag>
            <el-tag size="small" type="info">
              {{ formatTimestamp(history.createdAt) }}
            </el-tag>
          </div>
        </div>
        <div class="history-content">
          <div class="content-preview">
            {{ history.content.substring(0, 200) }}{{ history.content.length > 200 ? '...' : '' }}
          </div>
        </div>
        <div class="history-actions">
          <el-button size="small" @click="handleCompareHistory(index)">对比</el-button>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>

    <ChangeDiffDialog
      v-model="diffDialogOpen"
      :title="diffTitle"
      :sections="diffSections"
      kind="update"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { useThemeStore } from '../stores/themeStore';
import { useChangeFlagStore } from '../stores/changeFlagStore';
import ChangeDiffDialog from './ChangeDiffDialog.vue';
import type { DiffSection } from '../utils/diff';
import { formatTimestamp } from '@shared/utils';

interface Props {
  modelValue: boolean;
  themeId?: string | null;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const themeStore = useThemeStore();
const changeFlagStore = useChangeFlagStore();

const dialogVisible = ref(false);
const isLoading = ref(false);
const diffDialogOpen = ref(false);
const diffTitle = ref('');
const diffSections = ref<DiffSection[]>([]);

const historyList = computed(() => themeStore.themeHistory);

// 历史快照存的是修改前内容，与相邻历史（或当前内容）对照即为该次修改的变化
const handleCompareHistory = (index: number) => {
  const list = historyList.value;
  const before = list[index];
  if (!before) return;
  let afterLabel = '';
  let afterContent = '';
  if (index === 0) {
    const current = themeStore.theme;
    if (!current) return;
    afterLabel = '当前';
    afterContent = current.content;
  } else {
    const newer = list[index - 1];
    if (!newer) return;
    afterLabel = `v${newer.version}`;
    afterContent = newer.content;
  }
  const sections: DiffSection[] = [
    { label: '内容', before: before.content, after: afterContent },
  ].filter(section => section.before !== section.after);
  diffTitle.value = `主旨 · v${before.version} → ${afterLabel}`;
  diffSections.value = sections;
  diffDialogOpen.value = true;
  if (index === 0 && props.themeId) {
    changeFlagStore.clearFlag('theme', props.themeId);
  }
};

watch(
  () => props.modelValue,
  (value) => {
    dialogVisible.value = value;
  }
);

watch(
  dialogVisible,
  (value) => {
    emit('update:modelValue', value);
  }
);

watch(
  () => props.themeId,
  async (themeId) => {
    if (themeId && dialogVisible.value) {
      await loadHistory(themeId);
    }
  }
);

watch(
  dialogVisible,
  async (value) => {
    if (value && props.themeId) {
      await loadHistory(props.themeId);
    }
  }
);

const loadHistory = async (themeId: string) => {
  isLoading.value = true;
  try {
    await themeStore.loadThemeHistory(themeId);
  } catch (error) {
    console.error('加载主旨历史记录失败:', error);
  } finally {
    isLoading.value = false;
  }
};

const formatCreatedBy = (createdBy: string): string => {
  if (createdBy === 'user') {
    return '用户';
  } else if (createdBy === 'llm') {
    return 'AI';
  }
  return createdBy;
};

const handleClose = () => {
  dialogVisible.value = false;
};
</script>

<style scoped>
.loading-container {
  text-align: center;
  padding: 40px;
}

.loading-text {
  margin-top: 12px;
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}

.history-container {
  max-height: 500px;
  overflow-y: auto;
  padding: 4px;
}

.history-item {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 12px;
  background: #fafafa;
  transition: all 0.2s;
}

.history-item:hover {
  border-color: #409eff;
  background: #f0f9ff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.history-latest {
  border-color: #67c23a;
  background: #f0f9ff;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.history-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: #909399;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.latest-badge {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}

.badge-icon {
  font-size: 11px;
  margin-right: 4px;
}

.history-meta {
  display: flex;
  gap: 8px;
}

.history-content {
  margin-bottom: 12px;
}

.history-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px dashed #e4e7ed;
}

.content-preview {
  font-size: 13px;
  color: #303133;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
