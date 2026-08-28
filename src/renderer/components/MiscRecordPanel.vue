<template>
  <el-dialog
    :model-value="modelValue"
    title="杂项记录"
    width="94%"
    top="4vh"
    class="misc-record-dialog"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @open="handleDialogOpen"
  >
    <el-container class="record-layout">
      <!-- 左侧：搜索、筛选、列表 -->
      <el-aside v-if="!isFocusedView" class="record-sidebar">
        <el-input
          v-model="store.searchQuery"
          placeholder="搜索记录..."
          clearable
          class="sidebar-search"
        />
        <el-autocomplete
          v-model="store.selectedCategory"
          :fetch-suggestions="queryFilterCategorySuggestions"
          placeholder="输入分类筛选"
          clearable
          class="sidebar-category"
        />

        <el-tabs v-model="activeTab" class="record-tabs" @tab-change="handleTabChange">
          <el-tab-pane label="记录" name="records">
            <el-button
              type="primary"
              size="small"
              class="create-record-button"
              @click="handleCreateRecord"
            >
              新建记录
            </el-button>
            <el-scrollbar class="record-list-scroll">
              <div
                v-for="record in store.records"
                :key="record.id"
                :class="['record-item', { active: store.selectedRecord?.id === record.id }]"
                @click="handleSelectRecord(record)"
              >
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                  <span style="font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {{ record.title || '无标题' }}
                  </span>
                  <span
                    v-if="changeFlagStore.hasFlag('miscRecord', record.id)"
                    class="llm-change-dot"
                    title="AI 修改过此内容，点击查看后红点消失"
                  ></span>
                </div>
                <el-tag v-if="record.category" size="small" style="flex-shrink: 0;">
                  {{ record.category }}
                </el-tag>
              </div>
              <el-empty v-if="store.records.length === 0" description="暂无记录" :image-size="60" />
            </el-scrollbar>
          </el-tab-pane>
          <el-tab-pane label="回收站" name="trash">
            <el-scrollbar class="record-list-scroll">
              <div
                v-for="record in trashRecords"
                :key="record.id"
                class="record-item is-deleted"
                @click="handleSelectRecord(record)"
              >
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                  <span style="font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {{ record.title || '无标题' }}
                  </span>
                </div>
                <div style="display: flex; gap: 4px; flex-shrink: 0;">
                  <el-button size="small" text type="primary" @click.stop="handleRestore(record.id)">恢复</el-button>
                  <el-button size="small" text type="danger" @click.stop="handlePermanentDelete(record.id)">永久删除</el-button>
                </div>
              </div>
              <el-empty v-if="trashRecords.length === 0" description="回收站为空" :image-size="60" />
            </el-scrollbar>
          </el-tab-pane>
        </el-tabs>
      </el-aside>

      <!-- 右侧：内容查看与编辑区 -->
      <el-main class="record-main">
        <template v-if="store.selectedRecord">
          <div
            v-if="!isEditingRecord"
            :class="['record-viewer', { 'is-focused': isFocusedView }]"
          >
            <div class="viewer-header">
              <div class="viewer-title-group">
                <p class="viewer-eyebrow">杂项记录</p>
                <h3 class="viewer-title">
                  {{ store.selectedRecord.title || '无标题' }}
                </h3>
              </div>
              <div class="viewer-header-actions">
                <el-tag v-if="store.selectedRecord.category" size="small">
                  {{ store.selectedRecord.category }}
                </el-tag>
                <el-button
                  circle
                  :icon="isFocusedView ? Close : FullScreen"
                  :title="isFocusedView ? '退出沉浸查看' : '沉浸查看'"
                  @click="isFocusedView = !isFocusedView"
                />
              </div>
            </div>

            <div
              v-if="store.selectedRecord.deletedAt"
              class="viewer-deleted"
            >
              删除于 {{ formatTimestamp(store.selectedRecord.deletedAt) }}
            </div>

            <el-scrollbar class="viewer-content-scroll">
              <div
                v-if="store.selectedRecord.content"
                class="viewer-content markdown-content"
                v-html="renderedRecordContent"
              />
              <div v-else class="viewer-empty">
                这条记录还没有内容
              </div>
            </el-scrollbar>

            <div class="viewer-actions">
              <div class="viewer-primary-actions">
                <el-button
                  v-if="!store.selectedRecord.deleted"
                  type="primary"
                  @click="handleStartEdit"
                >
                  编辑
                </el-button>
                <el-button
                  :disabled="store.selectedRecord.deleted"
                  @click="handleShowVersions"
                >
                  版本历史
                </el-button>
              </div>
              <el-button
                v-if="!store.selectedRecord.deleted"
                type="danger"
                plain
                @click="handleDelete"
              >
                删除
              </el-button>
            </div>
          </div>

          <template v-else>
            <el-form label-width="60px" style="margin-bottom: 12px;">
              <el-form-item label="标题">
                <el-input v-model="editForm.title" placeholder="请输入标题" />
              </el-form-item>
              <el-form-item label="分类">
                <el-autocomplete
                  v-model="editForm.category"
                  :fetch-suggestions="queryCategorySuggestions"
                  placeholder="输入或选择分类"
                  clearable
                  style="width: 100%;"
                />
              </el-form-item>
            </el-form>
            <el-input
              v-model="editForm.content"
              type="textarea"
              :rows="10"
              placeholder="请输入内容"
              style="margin-bottom: 12px;"
            />
            <div style="display: flex; justify-content: space-between;">
              <div style="display: flex; gap: 8px;">
                <el-button type="primary" @click="handleSave">保存</el-button>
                <el-button @click="handleCancelEdit">取消</el-button>
              </div>
              <el-button type="danger" @click="handleDelete">删除</el-button>
            </div>
          </template>
        </template>
        <template v-else>
          <div class="viewer-empty is-page-empty">
            选择或创建一条记录
          </div>
        </template>
      </el-main>
    </el-container>
  </el-dialog>

  <!-- 版本历史弹窗 -->
  <el-dialog
    v-model="showVersionDialog"
    title="版本历史"
    width="700px"
    append-to-body
    destroy-on-close
  >
    <div v-if="store.isLoadingVersions" style="text-align: center; padding: 20px;">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
      <div style="margin-top: 8px; color: #999;">加载中...</div>
    </div>
    <div v-else-if="currentVersions.length === 0" style="text-align: center; padding: 40px; color: #999;">
      暂无版本记录
    </div>
    <div v-else class="versions-container">
      <div
        v-for="(version, index) in currentVersions"
        :key="version.id"
        class="version-item"
      >
        <div class="version-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="version-badge" :class="{ 'latest-badge': index === 0 }">
              v{{ version.version }}
            </span>
            <span style="font-size: 14px; font-weight: 500;">{{ version.title || '无标题' }}</span>
          </div>
          <el-tag size="small" type="info">{{ formatTimestamp(version.createdAt) }}</el-tag>
        </div>
        <div class="version-meta">
          <el-tag v-if="version.category" size="small" style="margin-right: 8px;">{{ version.category }}</el-tag>
        </div>
        <div class="version-content">
          {{ version.content || '无内容' }}
        </div>
        <div class="version-actions">
          <el-button type="primary" size="small" plain @click="handleRestoreVersion(version.id)">
            恢复此版本
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { Close, FullScreen, Loading } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { marked } from 'marked';
import { useMiscRecordStore } from '../stores/miscRecordStore';
import { useProjectStore } from '../stores/projectStore';
import { useChangeFlagStore } from '../stores/changeFlagStore';
import { formatTimestamp } from '@shared/utils';
import type { MiscRecord, MiscRecordVersion } from '@shared/types';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const store = useMiscRecordStore();
const projectStore = useProjectStore();
const changeFlagStore = useChangeFlagStore();

const activeTab = ref('records');
const trashRecords = ref<MiscRecord[]>([]);
const showVersionDialog = ref(false);
const isEditingRecord = ref(false);
const isFocusedView = ref(false);

const editForm = reactive({
  title: '',
  category: '',
  content: '',
});

const currentVersions = computed<MiscRecordVersion[]>(() => {
  if (!store.selectedRecord) return [];
  return store.getVersions(store.selectedRecord.id);
});

const renderedRecordContent = computed(() => {
  if (!store.selectedRecord?.content) return '';
  try {
    return marked(store.selectedRecord.content);
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return store.selectedRecord.content;
  }
});

// 弹窗打开时加载记录
const handleDialogOpen = () => {
  if (projectStore.currentProject) {
    store.selectRecord(null);
    isEditingRecord.value = false;
    isFocusedView.value = false;
    activeTab.value = 'records';
    store.loadRecords(projectStore.currentProject.id);
  }
};

// 搜索防抖
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => store.searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (projectStore.currentProject) {
      store.loadRecords(projectStore.currentProject.id);
    }
  }, 300);
});

// 分类筛选变化时重新加载并重置选中状态
watch(() => store.selectedCategory, () => {
  store.selectRecord(null);
  resetEditForm();
  isEditingRecord.value = false;
  if (projectStore.currentProject) {
    store.loadRecords(projectStore.currentProject.id);
  }
});

// Tab 切换
const handleTabChange = async (tabName: string | number) => {
  if (!projectStore.currentProject) return;
  if (tabName === 'trash') {
    await store.loadTrash(projectStore.currentProject.id);
    trashRecords.value = store.records;
  } else {
    await store.loadRecords(projectStore.currentProject.id);
  }
};

const resetEditForm = () => {
  editForm.title = '';
  editForm.category = '';
  editForm.content = '';
};

const handleSelectRecord = (record: MiscRecord) => {
  store.selectRecord(record);
  changeFlagStore.clearFlag('miscRecord', record.id);
  editForm.title = record.title || '';
  editForm.category = record.category || '';
  editForm.content = record.content || '';
  isEditingRecord.value = false;
};

const handleCreateRecord = async () => {
  if (!projectStore.currentProject) return;
  try {
    const newRecord = await store.createRecord(projectStore.currentProject.id, {
      title: '',
      category: '',
      content: '',
    });
    store.selectRecord(newRecord);
    isEditingRecord.value = true;
    editForm.title = '';
    editForm.category = '';
    editForm.content = '';
  } catch (error) {
    console.error('创建记录失败:', error);
    ElMessage.error('创建记录失败');
  }
};

const handleSave = async () => {
  if (!store.selectedRecord) return;
  try {
    const updated = await store.updateRecord(store.selectedRecord.id, {
      title: editForm.title,
      category: editForm.category,
      content: editForm.content,
    });
    store.selectRecord(updated);
    editForm.title = updated.title || '';
    editForm.category = updated.category || '';
    editForm.content = updated.content || '';
    isEditingRecord.value = false;
    ElMessage.success('保存成功');
  } catch (error) {
    console.error('保存记录失败:', error);
    ElMessage.error('保存失败');
  }
};

const handleStartEdit = () => {
  isEditingRecord.value = true;
};

const handleCancelEdit = () => {
  if (!store.selectedRecord) {
    isEditingRecord.value = false;
    return;
  }

  editForm.title = store.selectedRecord.title || '';
  editForm.category = store.selectedRecord.category || '';
  editForm.content = store.selectedRecord.content || '';
  isEditingRecord.value = false;
};

const handleDelete = async () => {
  if (!store.selectedRecord) return;
  try {
    await ElMessageBox.confirm(
      '确定要删除此记录吗？删除后可在回收站恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await store.deleteRecord(store.selectedRecord.id);
    store.selectRecord(null);
    resetEditForm();
    isEditingRecord.value = false;
    ElMessage.success('已删除');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除记录失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

const handleRestore = async (id: string) => {
  try {
    await store.restoreRecord(id);
    ElMessage.success('恢复成功');
    // 刷新回收站列表
    if (projectStore.currentProject && activeTab.value === 'trash') {
      await store.loadTrash(projectStore.currentProject.id);
      trashRecords.value = store.records;
    }
  } catch (error) {
    console.error('恢复记录失败:', error);
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
    await store.permanentDelete(id);
    ElMessage.success('永久删除成功');
    // 刷新回收站列表
    if (projectStore.currentProject && activeTab.value === 'trash') {
      await store.loadTrash(projectStore.currentProject.id);
      trashRecords.value = store.records;
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('永久删除失败:', error);
      ElMessage.error('永久删除失败');
    }
  }
};

// 版本历史
const handleShowVersions = async () => {
  if (!store.selectedRecord) return;
  showVersionDialog.value = true;
  await store.loadVersions(store.selectedRecord.id);
};

const handleRestoreVersion = async (versionId: string) => {
  if (!store.selectedRecord) return;
  try {
    const updated = await store.restoreVersion(store.selectedRecord.id, versionId);
    store.selectRecord(updated);
    // 用恢复后的数据更新编辑表单
    editForm.title = updated.title || '';
    editForm.category = updated.category || '';
    editForm.content = updated.content || '';
    isEditingRecord.value = false;
    // 刷新版本列表
    await store.loadVersions(store.selectedRecord.id);
    ElMessage.success('版本已恢复');
  } catch (error) {
    console.error('恢复版本失败:', error);
    ElMessage.error('恢复版本失败');
  }
};

// 分类自动补全（编辑区）
const queryCategorySuggestions = (queryString: string, cb: (results: { value: string }[]) => void) => {
  const results = store.categories
    .filter(cat => cat.toLowerCase().includes(queryString.toLowerCase()))
    .map(cat => ({ value: cat }));
  cb(results);
};

// 分类自动补全（筛选区）
const queryFilterCategorySuggestions = (queryString: string, cb: (results: { value: string }[]) => void) => {
  const results = store.categories
    .filter(cat => cat.toLowerCase().includes(queryString.toLowerCase()))
    .map(cat => ({ value: cat }));
  cb(results);
};
</script>

<style scoped>
:global(.misc-record-dialog) {
  max-width: min(1500px, 94vw);
  margin-top: 4vh;
}

:global(.misc-record-dialog .el-dialog__body) {
  padding-top: 0;
}

.record-layout {
  height: calc(100vh - 148px);
  min-height: 520px;
  max-height: 980px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.record-sidebar {
  display: flex;
  flex-direction: column;
  width: 320px;
  flex-shrink: 0;
  padding: 16px 12px;
  border-right: 1px solid #e4e7ed;
  background: #fafbfc;
}

.sidebar-search {
  margin-bottom: 8px;
}

.sidebar-category {
  width: 100%;
  margin-bottom: 12px;
}

.record-tabs {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.record-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.record-tabs :deep(.el-tab-pane) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.create-record-button {
  width: 100%;
  margin-bottom: 8px;
}

.record-list-scroll {
  flex: 1;
  min-height: 0;
}

.record-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 20px;
  overflow: hidden;
  background: #f7f8fa;
}

.record-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.viewer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fbff 0%, #f5f7fa 100%);
}

.record-viewer.is-focused .viewer-header,
.record-viewer.is-focused .viewer-content,
.record-viewer.is-focused .viewer-actions {
  max-width: 1120px;
  margin-right: auto;
  margin-left: auto;
}

.viewer-title-group {
  min-width: 0;
  flex: 1;
}

.viewer-eyebrow {
  margin: 0 0 6px;
  color: #409eff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.viewer-title {
  margin: 0;
  color: #303133;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  word-break: break-word;
}

.viewer-header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.viewer-deleted {
  margin-top: 12px;
  padding: 10px 14px;
  border: 1px solid #f3d19e;
  border-radius: 8px;
  background: #fdf6ec;
  color: #b25e00;
  font-size: 13px;
}

.viewer-content-scroll {
  flex: 1;
  min-height: 0;
  margin-top: 16px;
}

.viewer-content-scroll :deep(.el-scrollbar__view) {
  min-height: 100%;
}

.viewer-content {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 26px 32px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(48, 49, 51, 0.04);
  color: #303133;
  font-size: 15px;
  line-height: 1.9;
  word-break: break-word;
}

.viewer-content :deep(p) {
  margin: 0.7em 0;
}

.viewer-content :deep(h1),
.viewer-content :deep(h2),
.viewer-content :deep(h3),
.viewer-content :deep(h4) {
  margin: 1.2em 0 0.5em;
  color: #303133;
  font-weight: 700;
}

.viewer-content :deep(ul),
.viewer-content :deep(ol) {
  margin: 0.7em 0;
  padding-left: 1.8em;
}

.viewer-content :deep(blockquote) {
  margin: 1em 0;
  padding: 10px 14px;
  border-left: 3px solid #409eff;
  border-radius: 6px;
  background: #f5f9ff;
  color: #606266;
}

.viewer-content :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #f4f4f5;
  color: #c7254e;
  font-family: Consolas, Monaco, monospace;
  font-size: 0.9em;
}

.viewer-content :deep(pre) {
  margin: 1em 0;
  padding: 14px;
  border-radius: 8px;
  background: #282c34;
  color: #abb2bf;
  overflow-x: auto;
}

.viewer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 220px;
  border: 1px dashed #dcdfe6;
  border-radius: 12px;
  background: #fafafa;
  color: #909399;
  font-size: 14px;
}

.viewer-empty.is-page-empty {
  width: 100%;
}

.viewer-actions {
  width: 100%;
  max-width: 960px;
  margin: 16px auto 0;
  padding: 14px 16px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 14px rgba(48, 49, 51, 0.04);
}

.viewer-primary-actions {
  display: flex;
  gap: 8px;
}

.record-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 4px;
}

.record-item:hover {
  background-color: var(--el-fill-color-light);
}

.record-item.active {
  background-color: var(--el-color-primary-light-9);
}

.record-item.is-deleted {
  opacity: 0.6;
}

.versions-container {
  max-height: 500px;
  overflow-y: auto;
  padding: 4px;
}

.version-item {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 12px;
  background: #fafafa;
  transition: all 0.2s;
}

.version-item:hover {
  border-color: #409eff;
  background: #f0f9ff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: #909399;
  color: white;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.latest-badge {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}

.version-meta {
  margin-bottom: 8px;
}

.version-content {
  font-size: 13px;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  max-height: 120px;
  overflow-y: auto;
  padding: 8px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.version-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px dashed #e4e7ed;
  margin-top: 8px;
}

@media (max-width: 900px) {
  :global(.misc-record-dialog) {
    width: 96vw;
    margin-top: 2vh;
  }

  .record-layout {
    height: calc(100vh - 72px);
    max-height: none;
  }

  .record-sidebar {
    width: 248px;
    padding: 12px 8px;
  }

  .record-main {
    padding: 12px;
  }

  .viewer-header {
    padding: 14px;
  }

  .viewer-content {
    padding: 18px;
  }
}
</style>
