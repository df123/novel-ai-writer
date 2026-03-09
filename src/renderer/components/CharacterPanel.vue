<template>
  <el-aside style="width: 320px; border-left: 1px solid #e0e0e0; display: flex; flex-direction: column">
    <div style="padding: 12px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center">
      <span style="font-size: 16px; font-weight: 500">人物</span>
      <el-button :icon="Plus" circle size="small" @click="handleOpenCreateDialog" />
    </div>

    <div v-if="selectedCharacters.size > 0" style="padding: 8px; background-color: #ecf5ff">
      <span style="font-size: 12px">已选择 {{ selectedCharacters.size }} 个人物</span>
    </div>

    <el-scrollbar style="flex: 1">
      <div style="padding: 8px">
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
  </el-aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Plus, Edit, Delete, User } from '@element-plus/icons-vue';
import { useCharacterStore } from '../stores/characterStore';

const characterStore = useCharacterStore();
const { characters, selectedCharacters } = storeToRefs(characterStore);
const { createCharacter, updateCharacter, deleteCharacter, toggleCharacterSelection } = characterStore;

const dialogOpen = ref(false);
const editMode = ref(false);
const editId = ref<string | null>(null);
const name = ref('');
const personality = ref('');
const background = ref('');
const relationships = ref('');

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
      avatar: '',
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
</style>
