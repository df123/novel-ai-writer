<template>
  <el-dialog
    :model-value="modelValue"
    title="杂物记录"
    width="900px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @open="handleDialogOpen"
  >
    <el-container style="height: 600px">
      <!-- 左侧：搜索、筛选、列表 -->
      <el-aside width="300px" style="border-right: 1px solid #e4e7ed; display: flex; flex-direction: column; padding: 12px;">
        <el-input
          v-model="store.searchQuery"
          placeholder="搜索记录..."
          clearable
          style="margin-bottom: 8px;"
        />
        <el-select
          v-model="store.selectedCategory"
          placeholder="筛选分类"
          clearable
          style="margin-bottom: 12px; width: 100%;"
        >
          <el-option
            v-for="cat in store.categories"
            :key="cat"
            :label="cat"
            :value="cat"
          />
        </el-select>

        <el-tabs v-model="activeTab" style="flex: 1; display: flex; flex-direction: column;" @tab-change="handleTabChange">
          <el-tab-pane label="记录" name="records">
            <el-button
              type="primary"
              size="small"
              style="margin-bottom: 8px; width: 100%;"
              @click="handleCreateRecord"
            >
              新建记录
            </el-button>
            <el-scrollbar style="height: 420px;">
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
                </div>
                <el-tag v-if="record.category" size="small" style="flex-shrink: 0;">
                  {{ record.category }}
                </el-tag>
              </div>
              <el-empty v-if="store.records.length === 0" description="暂无记录" :image-size="60" />
            </el-scrollbar>
          </el-tab-pane>
          <el-tab-pane label="回收站" name="trash">
            <el-scrollbar style="height: 450px;">
              <div
                v-for="record in trashRecords"
                :key="record.id"
                class="record-item is-deleted"
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

      <!-- 右侧：编辑区 -->
      <el-main style="padding: 16px; overflow-y: auto;">
        <template v-if="store.selectedRecord">
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
              <el-button @click="handleShowVersions">版本历史</el-button>
            </div>
            <el-button type="danger" @click="handleDelete">删除</el-button>
          </div>
        </template>
        <template v-else>
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 16px;">
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
import { Loading } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useMiscRecordStore } from '../stores/miscRecordStore';
import { useProjectStore } from '../stores/projectStore';
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

const activeTab = ref('records');
const trashRecords = ref<MiscRecord[]>([]);
const showVersionDialog = ref(false);

const editForm = reactive({
  title: '',
  category: '',
  content: '',
});

const currentVersions = computed<MiscRecordVersion[]>(() => {
  if (!store.selectedRecord) return [];
  return store.getVersions(store.selectedRecord.id);
});

// 弹窗打开时加载记录
const handleDialogOpen = () => {
  if (projectStore.currentProject) {
    store.selectRecord(null);
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
  editForm.title = record.title || '';
  editForm.category = record.category || '';
  editForm.content = record.content || '';
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
    await store.updateRecord(store.selectedRecord.id, {
      title: editForm.title,
      category: editForm.category,
      content: editForm.content,
    });
    ElMessage.success('保存成功');
  } catch (error) {
    console.error('保存记录失败:', error);
    ElMessage.error('保存失败');
  }
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
    // 用恢复后的数据更新编辑表单
    editForm.title = updated.title || '';
    editForm.category = updated.category || '';
    editForm.content = updated.content || '';
    // 刷新版本列表
    await store.loadVersions(store.selectedRecord.id);
    ElMessage.success('版本已恢复');
  } catch (error) {
    console.error('恢复版本失败:', error);
    ElMessage.error('恢复版本失败');
  }
};

// 分类自动补全
const queryCategorySuggestions = (queryString: string, cb: (results: { value: string }[]) => void) => {
  const results = store.categories
    .filter(cat => cat.toLowerCase().includes(queryString.toLowerCase()))
    .map(cat => ({ value: cat }));
  cb(results);
};
</script>

<style scoped>
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
</style>
