<template>
  <el-aside :style="{ width: isCollapsed ? '50px' : '320px', borderLeft: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }">
    <div :style="{ padding: isCollapsed ? '12px 8px' : '12px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
      <span v-if="!isCollapsed" style="font-size: 16px; font-weight: 500">人物</span>
      <div :style="{ display: 'flex', gap: '4px', margin: isCollapsed ? '0 auto' : '' }">
        <el-button v-if="!isCollapsed" :icon="Plus" circle size="small" @click="handleOpenCreateDialog" />
        <el-button :icon="isCollapsed ? ArrowRight : ArrowLeft" circle size="small" @click="toggleCollapse" />
      </div>
    </div>

    <div v-if="!isCollapsed && selectedCharacters.size > 0" style="padding: 8px; background-color: #ecf5ff">
      <span style="font-size: 12px">已选择 {{ selectedCharacters.size }} 个人物</span>
    </div>

    <el-scrollbar v-if="!isCollapsed" style="flex: 1">
      <div style="padding: 8px">
        <div style="display: flex; gap: 8px; margin-bottom: 8px">
          <el-button size="small" @click="toggleAllCharacters(true)">全选</el-button>
          <el-button size="small" @click="toggleAllCharacters(false)">取消全选</el-button>
          <span style="font-size: 12px; color: #999; margin-left: auto; align-self: center">
            已选 {{ selectedCharacters.size }} / {{ characters.length }}
          </span>
        </div>
        <div
          v-for="character in characters"
          :key="character.id"
          class="character-item"
          @click="toggleCharacterSelection(character.id)"
        >
          <el-checkbox
            :model-value="selectedCharacters.has(character.id)"
            @change="toggleCharacterSelection(character.id)"
            style="margin-right: 12px"
          />
          <el-avatar :size="32" style="background-color: #67c23a; margin-right: 12px">
            <el-icon><User /></el-icon>
          </el-avatar>
          <div style="flex: 1; min-width: 0">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
              <span style="font-size: 14px; font-weight: 500">{{ character.name }}</span>
              <el-tag v-if="selectedCharacters.has(character.id)" size="small" type="primary">已选中</el-tag>
            </div>
            <div v-if="character.personality" style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
              {{ character.personality }}
            </div>
          </div>
          <div class="character-actions">
            <el-button :icon="Edit" circle size="small" text @click.stop="handleOpenEditDialog(character)" />
            <el-button :icon="Clock" circle size="small" text @click.stop="handleOpenVersionsDialog(character.id)" title="查看版本" />
            <el-button :icon="Delete" circle size="small" text @click.stop="deleteCharacter(character.id)" />
          </div>
        </div>
        <el-empty v-if="characters.length === 0" description="暂无人物，点击右上角添加" :image-size="60" />
      </div>
    </el-scrollbar>

    <el-dialog
      v-model="dialogOpen"
      :title="editMode ? '编辑人物' : '添加人物'"
      width="500px"
    >
      <el-form label-width="80px">
        <el-form-item label="姓名">
          <el-input v-model="name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="性格">
          <el-input
            v-model="personality"
            type="textarea"
            :rows="2"
            placeholder="请输入性格描述"
          />
        </el-form-item>
        <el-form-item label="背景">
          <el-input
            v-model="background"
            type="textarea"
            :rows="3"
            placeholder="请输入背景故事"
          />
        </el-form-item>
        <el-form-item label="关系">
          <el-input
            v-model="relationships"
            type="textarea"
            :rows="3"
            placeholder='{"张三": "朋友", "李四": "同事"}'
          />
          <template #footer>
            <span style="font-size: 12px; color: #999">例如: {"张三": "朋友", "李四": "同事"}</span>
          </template>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleCloseDialog">取消</el-button>
        <el-button type="primary" :disabled="!name.trim()" @click="handleSubmit">
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
              <span class="version-label">姓名:</span>
              <span class="version-value">{{ version.name || '-' }}</span>
            </div>
            <div v-if="version.personality" class="version-row">
              <span class="version-label">性格:</span>
              <span class="version-value">{{ version.personality }}</span>
            </div>
            <div v-if="version.background" class="version-row">
              <span class="version-label">背景:</span>
              <span class="version-value multi-line">{{ version.background }}</span>
            </div>
            <div v-if="version.relationships" class="version-row">
              <span class="version-label">关系:</span>
              <span class="version-value multi-line">{{ version.relationships }}</span>
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
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Plus, Edit, Delete, User, ArrowLeft, ArrowRight, Clock, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useCharacterStore } from '../stores/characterStore';

const characterStore = useCharacterStore();
const { characters, selectedCharacters, currentVersions, isLoadingVersions } = storeToRefs(characterStore);
const { createCharacter, updateCharacter, deleteCharacter, toggleCharacterSelection, clearCharacterSelection, loadVersions, restoreVersion } = characterStore;

const dialogOpen = ref(false);
const editMode = ref(false);
const editId = ref<string | null>(null);
const name = ref('');
const personality = ref('');
const background = ref('');
const relationships = ref('');
const isCollapsed = ref(false);
const versionsDialogOpen = ref(false);
const versionCharacterId = ref<string | null>(null);

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const toggleAllCharacters = (selectAll: boolean) => {
  if (selectAll) {
    const allCharacterIds = new Set(characters.value.map(c => c.id));
    selectedCharacters.value = allCharacterIds;
  } else {
    clearCharacterSelection();
  }
};

const handleOpenCreateDialog = () => {
  editMode.value = false;
  name.value = '';
  personality.value = '';
  background.value = '';
  relationships.value = '';
  dialogOpen.value = true;
};

const handleOpenEditDialog = (character: any) => {
  editMode.value = true;
  editId.value = character.id;
  name.value = character.name;
  personality.value = character.personality || '';
  background.value = character.background || '';
  relationships.value = character.relationships || '';
  dialogOpen.value = true;
};

const handleCloseDialog = () => {
  dialogOpen.value = false;
  name.value = '';
  personality.value = '';
  background.value = '';
  relationships.value = '';
};

const handleSubmit = async () => {
  if (!name.value.trim()) return;

  try {
    const characterData = {
      name: name.value,
      personality: personality.value,
      background: background.value,
      relationships: relationships.value,
      createVersion: true,
    };

    if (editMode.value && editId.value) {
      await updateCharacter(editId.value, characterData);
    } else {
      await createCharacter(characterData);
    }
    handleCloseDialog();
  } catch (error) {
    console.error('Failed to save character:', error);
  }
};

const handleOpenVersionsDialog = async (characterId: string) => {
  versionCharacterId.value = characterId;
  versionsDialogOpen.value = true;
  console.log('[CharacterPanel] Loading versions for character:', characterId);
  await loadVersions(characterId);
  console.log('[CharacterPanel] Loaded versions:', currentVersions.value);
  console.log('[CharacterPanel] Versions array:', currentVersions.value);
};

const handleRestoreVersion = async (versionId: string) => {
  if (!versionCharacterId.value) return;
  try {
    await restoreVersion(versionCharacterId.value, versionId);
    // 恢复后重新加载版本列表，确保用户可以看到新创建的版本
    await loadVersions(versionCharacterId.value);
    ElMessage.success('版本已恢复');
  } catch (error) {
    console.error('Failed to restore version:', error);
    ElMessage.error('恢复版本失败，请重试');
  }
};

const formatVersionDate = (timestamp: number | undefined): string => {
  if (timestamp == null || isNaN(timestamp) || timestamp < 1000000) {
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
</script>

<style scoped>
.character-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.character-item:hover {
  background-color: #f5f5f5;
}

.character-item:hover .character-actions {
  opacity: 1;
}

.character-actions {
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
