<template>
  <el-aside :style="{ width: isCollapsed ? '50px' : '320px', borderLeft: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }">
    <div :style="{ padding: isCollapsed ? '12px 8px' : '12px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
      <span v-if="!isCollapsed" class="panel-title">主旨</span>
      <div :style="{ display: 'flex', gap: '4px', margin: isCollapsed ? '0 auto' : '' }">
        <el-button v-if="!isCollapsed" :icon="Plus" circle size="small" @click="handleOpenCreateDialog" />
        <el-button :icon="isCollapsed ? ArrowRight : ArrowLeft" circle size="small" @click="toggleCollapse" />
      </div>
    </div>

    <el-scrollbar v-if="!isCollapsed" class="scrollbar-container">
      <div class="tab-content">
        <div v-if="theme" class="theme-container">
          <div class="theme-header">
            <span class="theme-title">{{ theme.title }}</span>
            <el-tag size="small" type="success">v{{ theme.version }}</el-tag>
          </div>
          <div class="theme-content">
            {{ theme.content }}
          </div>
          <div class="theme-actions">
            <el-button :icon="Edit" size="small" text @click="handleOpenEditDialog(theme)" title="编辑" />
            <el-button :icon="Clock" size="small" text @click="handleOpenHistoryDialog(theme.id)" title="历史记录" />
            <el-button :icon="Delete" size="small" text type="danger" @click="handleDeleteTheme(theme)" title="删除" />
          </div>
        </div>
        <div v-else class="no-theme">
          <el-empty description="暂无主旨，点击右上角添加" :image-size="60" />
        </div>
      </div>
    </el-scrollbar>

    <ThemeEditDialog
      v-model="editDialogOpen"
      :theme="editingTheme"
      @success="handleEditSuccess"
    />

    <ThemeHistoryDialog
      v-model="historyDialogOpen"
      :theme-id="historyThemeId"
    />
  </el-aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Plus, Edit, Delete, ArrowLeft, ArrowRight, Clock } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useThemeStore } from '../stores/themeStore';
import { useProjectStore } from '../stores/projectStore';
import ThemeEditDialog from './ThemeEditDialog.vue';
import ThemeHistoryDialog from './ThemeHistoryDialog.vue';
import type { Theme } from '@shared/types';

const themeStore = useThemeStore();
const projectStore = useProjectStore();
const { theme } = storeToRefs(themeStore);
const { loadTheme, saveTheme, updateTheme, deleteTheme } = themeStore;

const isCollapsed = ref(false);
const editDialogOpen = ref(false);
const historyDialogOpen = ref(false);
const editingTheme = ref<Theme | null>(null);
const historyThemeId = ref<string | null>(null);

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const handleOpenCreateDialog = () => {
  editingTheme.value = null;
  editDialogOpen.value = true;
};

const handleOpenEditDialog = (theme: Theme) => {
  editingTheme.value = theme;
  editDialogOpen.value = true;
};

const handleOpenHistoryDialog = (themeId: string) => {
  historyThemeId.value = themeId;
  historyDialogOpen.value = true;
};

const handleEditSuccess = async () => {
  if (projectStore.currentProject) {
    await loadTheme(projectStore.currentProject.id);
  }
};

const handleDeleteTheme = async (theme: Theme) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除此主旨吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await deleteTheme(theme.id);
    ElMessage.success('删除成功');
    if (projectStore.currentProject) {
      await loadTheme(projectStore.currentProject.id);
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除主旨失败:', error);
      ElMessage.error('删除失败');
    }
  }
};
</script>

<style scoped>
.panel-title {
  font-size: 16px;
  font-weight: 500;
}

.scrollbar-container {
  flex: 1;
}

.tab-content {
  padding: 8px;
}

.theme-container {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #f0f9ff;
}

.theme-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.theme-title {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.theme-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.no-theme {
  padding: 20px;
}
</style>
