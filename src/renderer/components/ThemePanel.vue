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
        <el-tabs v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane label="主旨" name="themes">
            <div v-if="currentTheme" class="current-theme">
              <div class="theme-header">
                <span class="theme-title">{{ currentTheme.title }}</span>
                <el-tag size="small" type="success">当前</el-tag>
              </div>
              <div class="theme-content">
                {{ currentTheme.content }}
              </div>
              <div class="theme-actions">
                <el-button :icon="Edit" size="small" text @click="handleOpenEditDialog(currentTheme)" title="编辑" />
                <el-button :icon="Clock" size="small" text @click="handleOpenHistoryDialog(currentTheme.id)" title="历史记录" />
              </div>
            </div>
            <div v-else class="no-theme">
              <el-empty description="暂无主旨，点击右上角添加" :image-size="60" />
            </div>

            <div v-if="themes.length > 1" class="other-themes">
              <div class="section-title">其他版本</div>
              <div
                v-for="theme in otherThemes"
                :key="theme.id"
                class="theme-item"
              >
                <div class="theme-header">
                  <span class="theme-title">{{ theme.title }}</span>
                  <el-tag size="small" type="info">v{{ theme.version }}</el-tag>
                </div>
                <div class="theme-content">
                  {{ truncate(theme.content, 100) }}
                </div>
                <div class="theme-actions">
                  <el-button :icon="Edit" size="small" text @click.stop="handleOpenEditDialog(theme)" title="编辑" />
                  <el-button :icon="Clock" size="small" text @click.stop="handleOpenHistoryDialog(theme.id)" title="历史记录" />
                  <el-button :icon="Delete" size="small" text type="danger" @click.stop="handleDeleteTheme(theme)" title="删除" />
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="回收站" name="trash">
            <div class="trash-header">
              <span class="trash-count">
                共 {{ trashThemes.length }} 个已删除主旨
              </span>
            </div>
            <div v-if="isLoadingTrash" class="loading-container">
              <el-icon class="is-loading" :size="24">
                <Loading />
              </el-icon>
              <div class="loading-text">加载中...</div>
            </div>
            <div
              v-else
              v-for="theme in trashThemes"
              :key="theme.id"
              class="theme-item is-deleted"
            >
              <div class="theme-header">
                <span class="theme-title">{{ theme.title }}</span>
                <el-tag type="info" size="small">已删除</el-tag>
              </div>
              <div class="theme-content">
                {{ truncate(theme.content, 100) }}
              </div>
              <div v-if="theme.deletedAt" class="deleted-time">
                删除于 {{ formatDeletedAt(theme.deletedAt) }}
              </div>
              <div class="theme-actions">
                <el-button :icon="RefreshLeft" size="small" text type="primary" @click.stop="handleRestore(theme.id)" title="恢复" />
                <el-button :icon="Delete" size="small" text type="danger" @click.stop="handlePermanentDelete(theme.id)" title="永久删除" />
              </div>
            </div>
            <el-empty v-if="trashThemes.length === 0 && !isLoadingTrash" description="回收站为空" :image-size="60" />
          </el-tab-pane>
        </el-tabs>
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
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { Plus, Edit, Delete, ArrowLeft, ArrowRight, Clock, Loading, RefreshLeft } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useThemeStore } from '../stores/themeStore';
import { useProjectStore } from '../stores/projectStore';
import { formatDeletedAt } from '@shared/utils';
import ThemeEditDialog from './ThemeEditDialog.vue';
import ThemeHistoryDialog from './ThemeHistoryDialog.vue';
import type { Theme } from '@shared/types';

// 截断文本工具函数
const truncate = (text: string, max: number): string => {
  return text.length > max ? text.substring(0, max) + '...' : text;
};

const themeStore = useThemeStore();
const projectStore = useProjectStore();
const { themes, currentTheme, trashThemes } = storeToRefs(themeStore);
const { loadThemes, loadCurrentTheme, loadTrashThemes, deleteTheme, restoreTheme, permanentDeleteTheme } = themeStore;

const isCollapsed = ref(false);
const activeTab = ref('themes');
const isLoadingTrash = ref(false);
const editDialogOpen = ref(false);
const historyDialogOpen = ref(false);
const editingTheme = ref<Theme | null>(null);
const historyThemeId = ref<string | null>(null);

const otherThemes = computed(() => {
  if (!currentTheme.value) return themes.value;
  return themes.value.filter(t => t.id !== currentTheme.value!.id);
});

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
    await loadThemes(projectStore.currentProject.id);
    await loadCurrentTheme(projectStore.currentProject.id);
  }
};

const handleDeleteTheme = async (theme: Theme) => {
  try {
    await ElMessageBox.confirm(
      '确定要将此主旨移至回收站吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await deleteTheme(theme.id);
    ElMessage.success('已移至回收站');
    if (projectStore.currentProject) {
      await loadThemes(projectStore.currentProject.id);
      await loadCurrentTheme(projectStore.currentProject.id);
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除主旨失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

const handleTabChange = async (tabName: string) => {
  if (tabName === 'trash' && projectStore.currentProject) {
    await loadTrash();
  }
};

const loadTrash = async () => {
  if (!projectStore.currentProject) return;
  isLoadingTrash.value = true;
  try {
    await loadTrashThemes(projectStore.currentProject.id);
  } catch (error) {
    console.error('加载回收站失败:', error);
    ElMessage.error('加载回收站失败');
  } finally {
    isLoadingTrash.value = false;
  }
};

const handleRestore = async (id: string) => {
  try {
    await restoreTheme(id);
    ElMessage.success('恢复成功');
    if (activeTab.value === 'trash') {
      await loadTrash();
    }
    if (projectStore.currentProject) {
      await loadThemes(projectStore.currentProject.id);
      await loadCurrentTheme(projectStore.currentProject.id);
    }
  } catch (error) {
    console.error('恢复主旨失败:', error);
    ElMessage.error('恢复失败');
  }
};

const handlePermanentDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '永久删除后无法恢复，确定要删除吗？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await permanentDeleteTheme(id);
    ElMessage.success('永久删除成功');
    if (activeTab.value === 'trash') {
      await loadTrash();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('永久删除主旨失败:', error);
      ElMessage.error('永久删除失败');
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

.current-theme {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 16px;
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

.other-themes {
  margin-top: 16px;
}

.section-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  padding-left: 4px;
}

.theme-item {
  position: relative;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  border: 1px solid #e4e7ed;
  margin-bottom: 8px;
}

.theme-item:hover {
  background-color: #f5f5f5;
  border-color: #409eff;
}

.theme-item:hover .theme-actions {
  opacity: 1;
}

.is-deleted {
  opacity: 0.6;
  background-color: #f5f5f5;
}

.is-deleted .theme-actions {
  opacity: 1;
}

.deleted-time {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.trash-header {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.trash-count {
  font-size: 12px;
  color: #999;
  margin-left: auto;
  align-self: center;
}

.loading-container {
  text-align: center;
  padding: 20px;
}

.loading-text {
  margin-top: 8px;
  color: #999;
}
</style>
