<template>
  <el-container style="height: 100vh; display: flex; flex-direction: column">
    <el-header style="background-color: #1976d2; color: white; padding: 0 16px; flex-shrink: 0; height: 60px">
      <el-row align="middle" style="height: 100%">
        <el-icon :size="24" style="margin-right: 12px">
          <HomeFilled />
        </el-icon>
        <span style="font-size: 18px; font-weight: 500; flex: 1">NovelAI Writer</span>
        <ProjectSelector style="margin: 0 8px" />
        <el-button
          :icon="Setting"
          circle
          style="margin-left: 8px"
          @click="showSettings = true"
        />
        <el-dropdown trigger="click" @command="handleMenuCommand">
          <el-button :icon="MoreFilled" circle />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="createProject">新建项目</el-dropdown-item>
              <el-dropdown-item command="settings">LLM设置</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-row>
    </el-header>

    <el-container style="flex: 1; overflow: hidden; display: flex; flex-direction: row">
      <TimelinePanel />
      <ChatPanel />
      <CharacterPanel />
    </el-container>

    <CreateProjectDialog
      v-model="showCreateProject"
      @close="showCreateProject = false"
    />
    
    <LLMSettingsDialog
      v-model="showSettings"
      @close="showSettings = false"
    />
  </el-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { HomeFilled, Setting, MoreFilled } from '@element-plus/icons-vue';
import { useProjectStore } from '../stores/projectStore';
import { useChatStore } from '../stores/chatStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useCharacterStore } from '../stores/characterStore';
import TimelinePanel from './TimelinePanel.vue';
import ChatPanel from './ChatPanel.vue';
import CharacterPanel from './CharacterPanel.vue';
import ProjectSelector from './ProjectSelector.vue';
import CreateProjectDialog from './CreateProjectDialog.vue';
import LLMSettingsDialog from './LLMSettingsDialog.vue';

const projectStore = useProjectStore();
const chatStore = useChatStore();
const timelineStore = useTimelineStore();
const characterStore = useCharacterStore();

const showSettings = ref(false);
const showCreateProject = ref(false);

watch(
  () => projectStore.currentProject,
  async (currentProject) => {
    if (currentProject) {
      await chatStore.loadChats(currentProject.id);
      await timelineStore.loadNodes(currentProject.id);
      await characterStore.loadCharacters(currentProject.id);
    }
  },
  { immediate: true }
);

const handleMenuCommand = (command: string) => {
  if (command === 'createProject') {
    showCreateProject.value = true;
  } else if (command === 'settings') {
    showSettings.value = true;
  }
};
</script>
