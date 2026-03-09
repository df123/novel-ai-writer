<template>
  <el-aside style="width: 300px; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column">
    <div style="padding: 12px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center">
      <span style="font-size: 16px; font-weight: 500">时间线</span>
      <el-button :icon="Plus" circle size="small" @click="handleOpenCreateDialog" />
    </div>

    <el-scrollbar style="flex: 1">
      <div style="padding: 8px">
        <div
          v-for="node in nodes"
          :key="node.id"
          :class="['node-item', { 'node-selected': selectedNode?.id === node.id }]"
          @click="handleSelect(node.id)"
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
            <el-icon v-if="selectedNode?.id === node.id" color="#409eff">
              <CircleCheck />
            </el-icon>
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
  </el-aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Plus, Edit, Delete, CircleCheck } from '@element-plus/icons-vue';
import { useTimelineStore } from '../stores/timelineStore';
import { formatDate } from '../../shared/utils';

const timelineStore = useTimelineStore();
const { nodes, selectedNode } = storeToRefs(timelineStore);
const { createNode, updateNode, deleteNode, selectNode } = timelineStore;

const dialogOpen = ref(false);
const editMode = ref(false);
const editId = ref<string | null>(null);
const title = ref('');
const date = ref('');
const description = ref('');

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
  date.value = node.date.split('T')[0];
  
  const content = node.content || '';
  const match = content.match(/Date: (.*?)\nDescription: (.*)/s);
  if (match) {
    date.value = match[1];
    description.value = match[2] || '';
  } else {
    description.value = content;
  }
  
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
      await updateNode(editId.value, { title: title.value, content });
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
