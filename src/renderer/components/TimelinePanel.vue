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
            {{ node.date || '未设置时间' }}
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
        <el-form-item label="时间">
          <el-input v-model="date" placeholder="请输入时间（如：康熙三年、银河纪元305年等）" />
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
      width="800px"
    >
      <div v-if="isLoadingVersions" style="text-align: center; padding: 20px">
        <el-icon class="is-loading" :size="24">
          <Loading />
        </el-icon>
        <div style="margin-top: 8px; color: #999">加载中...</div>
      </div>
      <div v-else-if="currentVersions.length === 0" style="text-align: center; padding: 40px; color: #999">
        暂无版本记录
      </div>
      <div v-else style="max-height: 500px; overflow-y: auto; padding: 4px">
        <div
          v-for="(version, index) in currentVersions"
          :key="version.id"
          class="version-item"
          :class="{ 'version-latest': index === 0 }"
        >
          <div class="version-header">
            <div class="version-badge" :class="{ 'latest-badge': index === 0 }">
              <span v-if="index === 0" style="font-size: 11px; margin-right: 4px">🔥</span>
              v{{ version.version }}
            </div>
            <el-tag size="small" type="info">
              {{ formatVersionDate(version.createdAt) }}
            </el-tag>
          </div>
          <div class="version-content">
            <div class="version-row">
              <span class="version-label">标题:</span>
              <span class="version-value">{{ version.title || '-' }}</span>
            </div>
            <div v-if="version.content" class="version-row">
              <span class="version-label">内容:</span>
              <div class="version-value multi-line">{{ parseVersionContent(version.content) }}</div>
            </div>
          </div>
          <div class="version-actions">
            <el-button
              type="primary"
              size="small"
              plain
              @click="handleRestoreVersion(version.id)"
            >
              恢复此版本
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </el-aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { Plus, Edit, Delete, CircleCheck, ArrowLeft, ArrowRight, Clock, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useTimelineStore } from '../stores/timelineStore';

const timelineStore = useTimelineStore();
const { nodes, selectedNode, selectedNodes, versions, isLoadingVersions } = storeToRefs(timelineStore);
const { createNode, updateNode, deleteNode, selectNode, toggleNodeSelection, toggleAllNodes, loadVersions, restoreVersion } = timelineStore;

// 获取当前节点的版本列表
const currentVersions = computed(() => {
  if (!versionNodeId.value) return [];
  return versions.value.get(versionNodeId.value) || [];
});

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
  date.value = '';
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
    if (editMode.value && editId.value) {
      await updateNode(editId.value, { title: title.value, date: date.value, content: description.value, createVersion: true });
    } else {
      await createNode(title.value, description.value, { date: date.value });
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
  console.log('[TimelinePanel] Loading versions for node:', nodeId);
  await loadVersions(nodeId);
  console.log('[TimelinePanel] Loaded versions:', versions.value);
  console.log('[TimelinePanel] Versions array:', Array.from(versions.value.values()).flat());
};

const handleRestoreVersion = async (versionId: string) => {
  if (!versionNodeId.value) return;
  try {
    await restoreVersion(versionNodeId.value, versionId);
    // 恢复后重新加载版本列表，确保用户可以看到新创建的版本
    await loadVersions(versionNodeId.value);
    ElMessage.success('版本已恢复');
  } catch (error) {
    console.error('Failed to restore version:', error);
    ElMessage.error('恢复版本失败，请重试');
  }
};

const formatVersionDate = (timestamp: number): string => {
  if (!timestamp || timestamp < 1000000) {
    return '未知时间';
  }
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      return '时间无效';
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diffMs / (1000 * 60));
        return minutes < 1 ? '刚刚' : `${minutes} 分钟前`;
      }
      return `${hours} 小时前`;
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays} 天前`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} 周前`;
    } else {
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  } catch {
    return '时间解析错误';
  }
};

const parseVersionContent = (content: string): string => {
  if (!content) return '';
  try {
    const lines = content.split('\n');
    const parsed: Record<string, string> = {};
    lines.forEach(line => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key === 'Date' || key === 'Description') {
          parsed[key] = value;
        }
      }
    });
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  } catch {
    return content;
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

.version-latest {
  border-color: #67c23a;
  background: #f0f9ff;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.version-badge {
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

.version-content {
  margin-bottom: 12px;
}

.version-row {
  display: flex;
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.version-label {
  min-width: 50px;
  color: #909399;
  font-weight: 500;
}

.version-value {
  flex: 1;
  color: #303133;
  word-break: break-all;
}

.version-value.multi-line {
  white-space: pre-wrap;
  line-height: 1.5;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.version-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px dashed #e4e7ed;
}
</style>
