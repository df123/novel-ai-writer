<template>
  <div class="theme-panel">
    <div class="panel-header">
      <span class="panel-title">主旨</span>
      <el-button v-if="!theme" :icon="Plus" type="primary" size="small" @click="handleOpenCreateDialog">
        添加主旨
      </el-button>
    </div>

    <div class="panel-content">
      <div v-if="theme && changeFlagStore.hasFlag('theme', theme.id)" class="ai-change-banner">
        <span class="llm-change-dot"></span>
        <span class="ai-change-banner-text">AI 修改过主旨，尚未查看</span>
        <el-button type="primary" link size="small" @click="handleViewThemeDiff">
          查看修改对比
        </el-button>
      </div>
      <div v-if="theme" class="theme-container">
        <div class="theme-header">
          <h3 class="theme-title">{{ theme.title }}</h3>
          <div class="theme-meta">
            <el-tag size="small" type="success">v{{ theme.version }}</el-tag>
            <el-tag size="small" :type="theme.createdBy === 'llm' ? 'info' : 'primary'">
              {{ theme.createdBy === 'llm' ? 'AI生成' : '用户创建' }}
            </el-tag>
          </div>
        </div>
        <div class="theme-content" v-html="renderedContent"></div>
        <div class="theme-actions">
          <el-button :icon="Edit" type="primary" size="small" @click="handleOpenEditDialog(theme)">
            编辑
          </el-button>
          <el-button :icon="CopyDocument" size="small" @click="handleViewThemeDiff">
            修改对比
          </el-button>
          <el-button :icon="Clock" size="small" @click="handleOpenHistoryDialog(theme.id)">
            历史记录
          </el-button>
          <el-button :icon="Delete" size="small" type="danger" @click="handleDeleteTheme(theme)">
            删除
          </el-button>
        </div>
      </div>
      <div v-else class="no-theme">
        <el-empty description="暂无主旨，点击右上角添加" :image-size="80" />
      </div>
    </div>

    <ThemeEditDialog
      v-model="editDialogOpen"
      :theme="editingTheme"
      @success="handleEditSuccess"
    />

    <ThemeHistoryDialog
      v-model="historyDialogOpen"
      :theme-id="historyThemeId"
    />

    <ChangeDiffDialog
      v-model="diffDialogOpen"
      :title="diffTitle"
      :sections="diffSections"
      :kind="diffKind"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { Plus, Edit, Delete, Clock, CopyDocument } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { marked } from 'marked';
import { useThemeStore } from '../stores/themeStore';
import { useProjectStore } from '../stores/projectStore';
import { useChangeFlagStore } from '../stores/changeFlagStore';
import ThemeEditDialog from './ThemeEditDialog.vue';
import ThemeHistoryDialog from './ThemeHistoryDialog.vue';
import ChangeDiffDialog from './ChangeDiffDialog.vue';
import type { DiffSection } from '../utils/diff';
import type { Theme } from '@shared/types';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const themeStore = useThemeStore();
const projectStore = useProjectStore();
const changeFlagStore = useChangeFlagStore();
const { theme } = storeToRefs(themeStore);
const { loadTheme, loadThemeHistory, updateTheme, deleteTheme } = themeStore;

const editDialogOpen = ref(false);
const historyDialogOpen = ref(false);
const editingTheme = ref<Theme | null>(null);
const historyThemeId = ref<string | null>(null);
const diffDialogOpen = ref(false);
const diffTitle = ref('');
const diffSections = ref<DiffSection[]>([]);
const diffKind = ref<'create' | 'update'>('update');

// 横幅入口：展示最近一次修改（最新历史快照 vs 当前内容）
const handleViewThemeDiff = async () => {
  const current = theme.value;
  if (!current) return;
  try {
    await loadThemeHistory(current.id);
  } catch (error) {
    console.error('加载主旨历史记录失败:', error);
  }
  const latest = themeStore.themeHistory[0];
  const sections: DiffSection[] = [
    { label: '内容', before: latest?.content ?? '', after: current.content },
  ].filter(section => section.before !== section.after);
  diffTitle.value = `${current.title} · ${latest ? `v${latest.version} → 当前` : '新增内容'}`;
  diffSections.value = sections;
  diffKind.value = latest ? 'update' : 'create';
  diffDialogOpen.value = true;
  changeFlagStore.clearFlag('theme', current.id);
};

const renderedContent = computed(() => {
  if (!theme.value) return '';
  try {
    return marked(theme.value.content);
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return theme.value.content;
  }
});

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
.theme-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
  background: #f5f7fa;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.panel-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.ai-change-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  margin-bottom: 12px;
  border: 1px solid #f3d19e;
  background-color: #fdf6ec;
  border-radius: 6px;
}

.ai-change-banner-text {
  font-size: 13px;
  color: #b88230;
}

.theme-container {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.theme-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.theme-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}

.theme-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.theme-content {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  word-break: break-word;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 4px;
}

.theme-content :deep(h1),
.theme-content :deep(h2),
.theme-content :deep(h3),
.theme-content :deep(h4),
.theme-content :deep(h5),
.theme-content :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  color: #303133;
}

.theme-content :deep(h1) {
  font-size: 1.8em;
  border-bottom: 2px solid #e4e7ed;
  padding-bottom: 0.3em;
}

.theme-content :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 0.3em;
}

.theme-content :deep(h3) {
  font-size: 1.3em;
}

.theme-content :deep(p) {
  margin: 0.8em 0;
}

.theme-content :deep(ul),
.theme-content :deep(ol) {
  margin: 0.8em 0;
  padding-left: 2em;
}

.theme-content :deep(li) {
  margin: 0.4em 0;
}

.theme-content :deep(code) {
  background: #f4f4f4;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: #e83e8c;
}

.theme-content :deep(pre) {
  background: #282c34;
  color: #abb2bf;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1em 0;
}

.theme-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
}

.theme-content :deep(blockquote) {
  border-left: 4px solid #409eff;
  padding-left: 16px;
  margin: 1em 0;
  color: #909399;
  background: #f5f7fa;
  padding: 12px 16px;
  border-radius: 0 4px 4px 0;
}

.theme-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.theme-content :deep(th),
.theme-content :deep(td) {
  border: 1px solid #e4e7ed;
  padding: 8px 12px;
  text-align: left;
}

.theme-content :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}

.theme-content :deep(a) {
  color: #409eff;
  text-decoration: none;
}

.theme-content :deep(a:hover) {
  text-decoration: underline;
}

.theme-content :deep(hr) {
  border: none;
  border-top: 1px solid #e4e7ed;
  margin: 2em 0;
}

.theme-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.theme-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.no-theme {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
}
</style>
