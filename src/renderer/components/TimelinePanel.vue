<template>
  <el-aside :style="{ width: isCollapsed ? '50px' : '300px', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }">
    <div :style="{ padding: isCollapsed ? '12px 8px' : '12px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
      <span v-if="!isCollapsed" style="font-size: 16px; font-weight: 500">时间线</span>
      <div :style="{ display: 'flex', gap: '4px', margin: isCollapsed ? '0 auto' : '' }">
        <el-button v-if="!isCollapsed" :icon="Plus" circle size="small" @click="handleOpenCreateDialog" />
        <el-button :icon="isCollapsed ? ArrowLeft : ArrowRight" circle size="small" @click="toggleCollapse" />
      </div>
    </div>

    <el-scrollbar v-if="!isCollapsed" style="flex: 1">
      <div style="padding: 8px">
        <div style="display: flex; gap: 8px; margin-bottom: 8px">
          <el-button size="small" @click="toggleAllNodes(true)">全选</el-button>
          <el-button size="small" @click="toggleAllNodes(false)">取消全选</el-button>
          <span style="font-size: 12px; color: #999; margin-left: auto; align-self: center">
            已选 {{ selectedNodes.size }} / {{ nodes.length }}
          </span>
        </div>
        <div
          v-for="node in nodes"
          :key="node.id"
          :class="['node-item', { 'node-selected': selectedNode?.id === node.id }]"
          @click="handleSelect(node.id)"
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
            <el-checkbox :model-value="selectedNodes.has(node.id)" @change="(val: any) => toggleNodeSelection(node.id)" @click.stop />
            <span style="font-size: 14px; font-weight: 500">{{ node.title }}</span>
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 2px">
            {{ formatDate(node.date) }}
          </div>
           <div v-if="node.content" style="font-size: 12px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
            {{ node.content }}
          </div>
          <div class="node-actions">
            <el-button :icon="Edit" circle size="small" text @click.stop="handleOpenEditDialog(node)" />
            <el-button :icon="Clock" circle size="small" text @click.stop="handleOpenVersionsDialog(node.id)" title="查看版本" />
            <el-button :icon="Delete" circle size="small" text @click.stop="deleteNode(node.id)" />
          </div>
        </div>
        <el-empty v-if="nodes.length === 0" description="暂无时间节点，点击右上角添加" :image-size="60" />
      </div>
    </el-scrollbar>

    <el-dialog
      v-model="dialogOpen"
      :title="editMode ? '编辑时间节点' : '添加时间节点'"
      width="500px"
    >
      <el-form label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="date"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="description"
            type="textarea"
            :rows="4"
            placeholder="请输入描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleCloseDialog">取消</el-button>
        <el-button type="primary" :disabled="!title.trim()" @click="handleSubmit">
          {{ editMode ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="versionsDialogOpen"
      title="版本历史"
      width="700px"
    >
      <div v-if="isLoadingVersions" style="text-align: center; padding: 20px">
        <el-icon class="is-loading" :size="24">
          <Loading />
        </el-icon>
        <div style="margin-top: 8px; color: #999">加载中...</div>
      </div>
      <div v-else-if="versions.length === 0" style="text-align: center; padding: 40px; color: #999">
        暂无版本记录
      </div>
      <div v-else style="max-height: 400px; overflow-y: auto">
        <div
          v-for="version in versions"
          :key="version.id"
          style="padding: 12px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
            <span style="font-weight: 500">版本 {{ version.version }}</span>
            <el-button type="primary" size="small" @click="handleRestoreVersion(version.id)">
              恢复此版本
            </el-button>
          </div>
          <div style="font-size: 13px; color: #666; margin-bottom: 4px">
            标题: {{ version.title }}
          </div>
          <div v-if="version.content" style="font-size: 12px; color: #999; white-space: pre-wrap">
            {{ version.content }}
          </div>
          <div style="font-size: 11px; color: #ccc; margin-top: 4px">
            {{ new Date(version.createdAt * 1000).toLocaleString('zh-CN') }}
          </div>
        </div>
      </div>
    </el-dialog>
  </el-aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Plus, Edit, Delete, CircleCheck, ArrowLeft, ArrowRight, Clock, Loading } from '@element-plus/icons-vue';
import { useTimelineStore } from '../stores/timelineStore';
import { formatDate } from '../../shared/utils';

const timelineStore = useTimelineStore();
const { nodes, selectedNode, selectedNodes, versions, isLoadingVersions } = storeToRefs(timelineStore);
const { createNode, updateNode, deleteNode, selectNode, toggleNodeSelection, toggleAllNodes, loadVersions, restoreVersion } = timelineStore;

const dialogOpen = ref(false);
const editMode = ref(false);
const editId = ref<string | null>(null);
const title = ref('');
const date = ref('');
const description = ref('');
const isCollapsed = ref(false);
const versionsDialogOpen = ref(false);
const versionNodeId = ref<string | null>(null);

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const handleOpenCreateDialog = () => {
  editMode.value = false;
  title.value = '';
  date.value = new Date().toISOString().split('T')[0];
  description.value = '';
  dialogOpen.value = true;
};

const handleOpenEditDialog = (node: any) => {
  editMode.value = true;
  editId.value = node.id;
  title.value = node.title;
  date.value = node.date || '';
  description.value = node.description || '';
  dialogOpen.value = true;
};

const handleCloseDialog = () => {
  dialogOpen.value = false;
  title.value = '';
  date.value = '';
  description.value = '';
};

const handleSubmit = async () => {
  if (!title.value.trim()) return;

  try {
    const content = `Date: ${date.value}\nDescription: ${description.value}`;
    if (editMode.value && editId.value) {
      await updateNode(editId.value, { title: title.value, content, createVersion: true });
    } else {
      await createNode(title.value, content);
    }
    handleCloseDialog();
  } catch (error) {
    console.error('Failed to save timeline node:', error);
  }
};

const handleSelect = (id: string) => {
  if (selectedNode.value?.id === id) {
    selectNode(null);
  } else {
    selectNode(id);
  }
};

const handleOpenVersionsDialog = async (nodeId: string) => {
  versionNodeId.value = nodeId;
  versionsDialogOpen.value = true;
  await loadVersions(nodeId);
};

const handleRestoreVersion = async (versionId: string) => {
  if (!versionNodeId.value) return;
  try {
    await restoreVersion(versionNodeId.value, versionId);
    versionsDialogOpen.value = false;
  } catch (error) {
    console.error('Failed to restore version:', error);
  }
};
</script>

<style scoped>
.node-item {
  position: relative;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  border: 1px solid transparent;
}

.node-item:hover {
  background-color: #f5f5f5;
}

.node-item:hover .node-actions {
  opacity: 1;
}

.node-selected {
  background-color: #ecf5ff;
  border-color: #409eff;
}

.node-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}
</style>
