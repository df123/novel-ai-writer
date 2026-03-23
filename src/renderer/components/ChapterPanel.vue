<template>
  <el-aside :style="{ width: isCollapsed ? '50px' : '300px', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }">
    <div :style="{ padding: isCollapsed ? '12px 8px' : '12px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
      <span v-if="!isCollapsed" class="panel-title">章节</span>
      <div :style="{ display: 'flex', gap: '4px', margin: isCollapsed ? '0 auto' : '' }">
        <el-button v-if="!isCollapsed" :icon="Download" circle size="small" @click="handleExport" title="导出章节" />
        <el-button :icon="isCollapsed ? ArrowLeft : ArrowRight" circle size="small" @click="toggleCollapse" />
      </div>
    </div>

    <el-scrollbar v-if="!isCollapsed" class="scrollbar-container">
      <div class="tab-content">
        <el-tabs v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane label="章节列表" name="chapters">
            <div
              v-for="chapter in sortedChapters"
              :key="chapter.id"
              class="chapter-item"
              @click="handleChapterClick(chapter)"
            >
              <div class="chapter-header">
                <span class="chapter-number">第 {{ chapter.chapterNumber }} 章</span>
                <span class="chapter-title">{{ chapter.title }}</span>
              </div>
              <div class="chapter-preview">
                {{ chapter.content.substring(0, 50) }}...
              </div>
              <div class="chapter-actions">
                <el-button :icon="Edit" circle size="small" text @click.stop="handleEdit(chapter)" title="编辑" />
                <el-button :icon="Delete" circle size="small" text type="danger" @click.stop="handleDelete(chapter)" title="删除" />
              </div>
            </div>
            <el-empty v-if="sortedChapters.length === 0" description="暂无章节，从聊天记录中保存" :image-size="60" />
          </el-tab-pane>
          <el-tab-pane label="回收站" name="trash">
            <div class="trash-header">
              <span class="trash-count">
                共 {{ deletedChapters.length }} 个已删除章节
              </span>
              <el-button v-if="deletedChapters.length > 0" size="small" type="danger" plain @click="handleEmptyTrash">
                清空回收站
              </el-button>
            </div>
            <div v-if="isLoadingTrash" class="loading-container">
              <el-icon class="is-loading" :size="24">
                <Loading />
              </el-icon>
              <div class="loading-text">加载中...</div>
            </div>
            <div
              v-else
              v-for="chapter in deletedChapters"
              :key="chapter.id"
              class="chapter-item is-deleted"
            >
              <div class="chapter-header">
                <span class="chapter-number">第 {{ chapter.chapterNumber }} 章</span>
                <span class="chapter-title">{{ chapter.title }}</span>
              </div>
              <div class="chapter-preview">
                {{ chapter.content.substring(0, 50) }}...
              </div>
              <div v-if="chapter.deletedAt" class="deleted-time">
                删除于 {{ formatDeletedAt(chapter.deletedAt) }}
              </div>
              <div class="chapter-actions">
                <el-button :icon="RefreshLeft" circle size="small" text type="primary" @click.stop="handleRestore(chapter)" title="恢复" />
                <el-button :icon="Delete" circle size="small" text type="danger" @click.stop="handlePermanentDelete(chapter)" title="永久删除" />
              </div>
            </div>
            <el-empty v-if="deletedChapters.length === 0 && !isLoadingTrash" description="回收站为空" :image-size="60" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-scrollbar>

    <el-dialog
      v-model="editDialogOpen"
      title="编辑章节"
      width="800px"
    >
      <el-form label-width="80px">
        <el-form-item label="章节编号">
          <el-input-number v-model="editChapterNumber" :min="1" />
        </el-form-item>
        <el-form-item label="章节标题">
          <el-input v-model="editTitle" placeholder="请输入章节标题" />
        </el-form-item>
        <el-form-item label="章节内容">
          <el-input
            v-model="editContent"
            type="textarea"
            :rows="15"
            placeholder="请输入章节内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!editTitle.trim() || !editContent.trim()" @click="handleSaveEdit">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="readerDialogOpen"
      title="章节阅读"
      width="80%"
      :close-on-click-modal="false"
    >
      <ChapterReader
        v-if="currentChapter"
        :chapter="currentChapter"
        :chapters="sortedChapters"
        @close="readerDialogOpen = false"
        @navigate="handleNavigate"
      />
    </el-dialog>
  </el-aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { Edit, Delete, Download, ArrowLeft, ArrowRight, Loading, RefreshLeft } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useChapterStore } from '../stores/chapterStore';
import { useProjectStore } from '../stores/projectStore';
import { formatDeletedAt } from '@shared/utils';
import { type Chapter } from '@shared/types';
import ChapterReader from './ChapterReader.vue';

const chapterStore = useChapterStore();
const projectStore = useProjectStore();
const { chapters, currentChapter, isLoading, deletedChapters } = storeToRefs(chapterStore);
const { loadChapters, deleteChapter, updateChapter, restoreChapter, permanentDeleteChapter, exportChapters, loadTrashChapters, emptyTrash, setCurrentChapter } = chapterStore;

const isCollapsed = ref(false);
const activeTab = ref('chapters');
const isLoadingTrash = ref(false);
const editDialogOpen = ref(false);
const readerDialogOpen = ref(false);
const editChapterId = ref<string | null>(null);
const editChapterNumber = ref(1);
const editTitle = ref('');
const editContent = ref('');

const sortedChapters = computed(() => {
  // 过滤掉已删除的章节，只显示正常章节
  const sorted = [...chapters.value]
    .filter(ch => !ch.deleted)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  return sorted;
});

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
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
    await loadTrashChapters(projectStore.currentProject.id);
  } catch (error) {
    console.error('Failed to load trash:', error);
    ElMessage.error('加载回收站失败');
  } finally {
    isLoadingTrash.value = false;
  }
};

const handleChapterClick = (chapter: Chapter) => {
  setCurrentChapter(chapter);
  readerDialogOpen.value = true;
};

const handleEdit = (chapter: Chapter) => {
  editChapterId.value = chapter.id;
  editChapterNumber.value = chapter.chapterNumber;
  editTitle.value = chapter.title;
  editContent.value = chapter.content || '';
  editDialogOpen.value = true;
};

const handleSaveEdit = async () => {
  if (!editChapterId.value || !projectStore.currentProject) return;

  try {
    await updateChapter(projectStore.currentProject.id, editChapterId.value, {
      chapterNumber: editChapterNumber.value,
      title: editTitle.value,
      content: editContent.value
    });
    editDialogOpen.value = false;
    ElMessage.success('保存成功');
  } catch (error) {
    console.error('Failed to update chapter:', error);
    ElMessage.error('保存失败，请重试');
  }
};

const handleDelete = async (chapter: Chapter) => {
  if (!projectStore.currentProject) return;

  try {
    await ElMessageBox.confirm(
      '确定要将此章节移至回收站吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await deleteChapter(projectStore.currentProject.id, chapter.id);
    ElMessage.success('已移至回收站');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete chapter:', error);
      ElMessage.error('删除失败');
    }
  }
};

const handleRestore = async (chapter: Chapter) => {
  if (!projectStore.currentProject) return;

  try {
    await restoreChapter(projectStore.currentProject.id, chapter.id);
    ElMessage.success('恢复成功');
    if (activeTab.value === 'trash') {
      await loadTrash();
    }
  } catch (error) {
    console.error('Failed to restore chapter:', error);
    ElMessage.error('恢复失败');
  }
};

const handlePermanentDelete = async (chapter: Chapter) => {
  if (!projectStore.currentProject) return;

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
    await permanentDeleteChapter(projectStore.currentProject.id, chapter.id);
    ElMessage.success('永久删除成功');
    if (activeTab.value === 'trash') {
      await loadTrash();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to permanent delete chapter:', error);
      ElMessage.error('永久删除失败');
    }
  }
};

const handleEmptyTrash = async () => {
  if (!projectStore.currentProject) return;

  try {
    await ElMessageBox.confirm(
      '确定要清空回收站吗？此操作不可恢复。',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await emptyTrash(projectStore.currentProject.id);
    ElMessage.success('回收站已清空');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to empty trash:', error);
      ElMessage.error('清空回收站失败');
    }
  }
};

const handleExport = async () => {
  if (!projectStore.currentProject) return;

  try {
    await ElMessageBox.confirm(
      '请选择导出格式',
      '导出章节',
      {
        confirmButtonText: 'TXT',
        cancelButtonText: 'Markdown',
        distinguishCancelAndClose: true,
        type: 'info',
      }
    ).then(() => {
      exportChapters(projectStore.currentProject!.id, 'txt');
    }).catch((action) => {
      if (action === 'cancel') {
        exportChapters(projectStore.currentProject!.id, 'md');
      }
    });
    ElMessage.success('导出成功');
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      console.error('Failed to export chapters:', error);
      ElMessage.error('导出失败');
    }
  }
};

const handleNavigate = (direction: 'prev' | 'next') => {
  if (!currentChapter.value) return;

  const currentIndex = sortedChapters.value.findIndex(ch => ch.id === currentChapter.value!.id);
  if (currentIndex === -1) return;

  if (direction === 'prev' && currentIndex > 0) {
    setCurrentChapter(sortedChapters.value[currentIndex - 1]);
  } else if (direction === 'next' && currentIndex < sortedChapters.value.length - 1) {
    setCurrentChapter(sortedChapters.value[currentIndex + 1]);
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

.chapter-item {
  position: relative;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  border: 1px solid #e4e7ed;
  margin-bottom: 8px;
}

.chapter-item:hover {
  background-color: #f5f5f5;
  border-color: #409eff;
}

.chapter-item:hover .chapter-actions {
  opacity: 1;
}

.is-deleted {
  opacity: 0.6;
  background-color: #f5f5f5;
}

.is-deleted .chapter-actions {
  opacity: 1;
}

.chapter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.chapter-number {
  font-size: 12px;
  color: #409eff;
  font-weight: 600;
  white-space: nowrap;
}

.chapter-title {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-preview {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
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
  align-items: center;
}

.trash-count {
  font-size: 12px;
  color: #999;
  flex: 1;
}

.loading-container {
  text-align: center;
  padding: 20px;
}

.loading-text {
  margin-top: 8px;
  color: #999;
}

.chapter-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  gap: 4px;
}
</style>
