<template>
  <el-container class="main-container">
    <el-header class="app-header">
      <el-row align="middle" class="header-row">
        <el-icon :size="24" class="logo-icon">
          <HomeFilled />
        </el-icon>
        <span class="app-title">NovelAI Writer</span>
        <ProjectSelector class="project-selector" />
        <el-button
          :icon="Reading"
          type="primary"
          class="chapter-button"
          @click="showChapterDialog = true"
        >
          章节管理
        </el-button>
        <el-button
          :icon="Document"
          type="primary"
          class="theme-button"
          @click="showThemeDialog = true"
        >
          主旨管理
        </el-button>
        <el-button
          :icon="Setting"
          circle
          class="settings-button"
          @click="showSettings = true"
        />
        <el-dropdown trigger="click" @command="handleMenuCommand">
          <el-button :icon="MoreFilled" circle />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="createProject">新建项目</el-dropdown-item>
              <el-dropdown-item command="settings">LLM设置</el-dropdown-item>
              <el-dropdown-item command="database">数据库管理</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-row>
    </el-header>

    <el-container class="content-container">
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
    
    <el-dialog
      v-model="showDatabase"
      title="数据库管理"
      width="80%"
      :close-on-click-modal="false"
    >
      <DatabasePanel />
    </el-dialog>

    <el-dialog
      v-model="showChapterDialog"
      title="章节管理"
      width="80%"
    >
      <ChapterPanel />
    </el-dialog>

    <el-dialog
      v-model="showThemeDialog"
      title="主旨管理"
      width="80%"
    >
      <ThemePanel />
    </el-dialog>
  </el-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { HomeFilled, Setting, MoreFilled, Reading, Document } from '@element-plus/icons-vue';
import { useProjectStore } from '../stores/projectStore';
import { useChatStore } from '../stores/chatStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useCharacterStore } from '../stores/characterStore';
import { useChapterStore } from '../stores/chapterStore';
import { useThemeStore } from '../stores/themeStore';
import ChapterPanel from './ChapterPanel.vue';
import TimelinePanel from './TimelinePanel.vue';
import ChatPanel from './ChatPanel.vue';
import CharacterPanel from './CharacterPanel.vue';
import ThemePanel from './ThemePanel.vue';
import ProjectSelector from './ProjectSelector.vue';
import CreateProjectDialog from './CreateProjectDialog.vue';
import LLMSettingsDialog from './LLMSettingsDialog.vue';
import DatabasePanel from './DatabasePanel.vue';

const projectStore = useProjectStore();
const chatStore = useChatStore();
const timelineStore = useTimelineStore();
const characterStore = useCharacterStore();
const chapterStore = useChapterStore();
const themeStore = useThemeStore();

const showSettings = ref(false);
const showCreateProject = ref(false);
const showDatabase = ref(false);
const showChapterDialog = ref(false);
const showThemeDialog = ref(false);

watch(
  () => projectStore.currentProject,
  async (currentProject) => {
    if (currentProject) {
      await chatStore.loadChats(currentProject.id);
      await timelineStore.loadNodes(currentProject.id);
      await characterStore.loadCharacters(currentProject.id);
      await chapterStore.loadChapters(currentProject.id);
      await themeStore.loadThemes(currentProject.id);
      await themeStore.loadCurrentTheme(currentProject.id);
    } else {
      themeStore.clearThemes();
    }
  },
  { immediate: true }
);

const handleMenuCommand = (command: string) => {
  if (command === 'createProject') {
    showCreateProject.value = true;
  } else if (command === 'settings') {
    showSettings.value = true;
  } else if (command === 'database') {
    showDatabase.value = true;
  }
};
</script>

<style scoped>
.main-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: #1976d2;
  color: white;
  padding: 0 16px;
  flex-shrink: 0;
  height: 60px;
}

.header-row {
  height: 100%;
}

.logo-icon {
  margin-right: 12px;
}

.app-title {
  font-size: 18px;
  font-weight: 500;
  flex: 1;
}

.project-selector {
  margin: 0 8px;
}

.chapter-button {
  margin-left: 8px;
}

.theme-button {
  margin-left: 8px;
}

.settings-button {
  margin-left: 8px;
}

.content-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: row;
}
</style>
