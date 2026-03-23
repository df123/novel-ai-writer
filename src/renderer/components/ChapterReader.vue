<template>
  <div class="chapter-reader">
    <div class="reader-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="handleClose" />
        <h2 class="chapter-title">第 {{ chapter.chapterNumber }} 章 - {{ chapter.title }}</h2>
      </div>
      <div class="header-right">
        <el-button-group>
          <el-button :icon="ZoomOut" @click="decreaseFontSize" />
          <el-button :icon="ZoomIn" @click="increaseFontSize" />
        </el-button-group>
        <el-button :icon="Sunny" v-if="isDark" @click="toggleTheme" title="切换到亮色主题" />
        <el-button :icon="Moon" v-else @click="toggleTheme" title="切换到暗色主题" />
        <el-button :icon="ChatDotRound" type="primary" @click="handleChatWithContext">
          基于此章节对话
        </el-button>
      </div>
    </div>

    <div class="reader-content" :class="{ 'dark-theme': isDark }">
      <div class="content-wrapper" :style="{ fontSize: fontSize + 'px' }">
        <div class="chapter-text">{{ chapter.content }}</div>
      </div>
    </div>

    <div class="reader-footer">
      <el-button :icon="ArrowLeft" :disabled="!hasPrev" @click="handlePrev">
        上一章
      </el-button>
      <span class="chapter-info">
        {{ currentIndex + 1 }} / {{ chapters.length }}
      </span>
      <el-button :disabled="!hasNext" @click="handleNext">
        下一章
        <el-icon class="el-icon--right"><ArrowRight /></el-icon>
      </el-button>
    </div>

    <el-drawer v-model="drawerVisible" title="章节目录" size="300px" direction="rtl">
      <div class="chapter-list">
        <div
          v-for="(ch, index) in chapters"
          :key="ch.id"
          :class="['chapter-list-item', { active: ch.id === chapter.id }]"
          @click="handleSelectChapter(index)"
        >
          <span class="list-chapter-number">第 {{ ch.chapterNumber }} 章</span>
          <span class="list-chapter-title">{{ ch.title }}</span>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Sunny, Moon, ChatDotRound } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useChatStore } from '../stores/chatStore';
import { useProjectStore } from '../stores/projectStore';
import type { Chapter } from '@shared/types';

interface Props {
  chapter: Chapter;
  chapters: Chapter[];
}

interface Emits {
  (e: 'close'): void;
  (e: 'navigate', direction: 'prev' | 'next'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const chatStore = useChatStore();
const projectStore = useProjectStore();

const fontSize = ref(16);
const isDark = ref(false);
const drawerVisible = ref(false);

const currentIndex = computed(() => {
  return props.chapters.findIndex(ch => ch.id === props.chapter.id);
});

const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value < props.chapters.length - 1);

const increaseFontSize = () => {
  if (fontSize.value < 32) {
    fontSize.value += 2;
  }
};

const decreaseFontSize = () => {
  if (fontSize.value > 12) {
    fontSize.value -= 2;
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
};

const handleClose = () => {
  emit('close');
};

const handlePrev = () => {
  emit('navigate', 'prev');
};

const handleNext = () => {
  emit('navigate', 'next');
};

const handleSelectChapter = (index: number) => {
  if (index !== currentIndex.value) {
    const direction = index < currentIndex.value ? 'prev' : 'next';
    emit('navigate', direction);
  }
  drawerVisible.value = false;
};

const handleChatWithContext = () => {
  if (!projectStore.currentProject) {
    ElMessage.warning('请先选择项目');
    return;
  }

  chatStore.setChapterContext(props.chapter);
  ElMessage.success('已设置章节上下文，现在可以基于此章节进行对话');
  handleClose();
};
</script>

<style scoped>
.chapter-reader {
  display: flex;
  flex-direction: column;
  height: 70vh;
}

.reader-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f5f5f5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chapter-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reader-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: #ffffff;
  transition: background-color 0.3s;
}

.reader-content.dark-theme {
  background-color: #1a1a1a;
}

.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.8;
}

.chapter-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #303133;
  transition: color 0.3s;
}

.dark-theme .chapter-text {
  color: #e0e0e0;
}

.reader-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  background-color: #f5f5f5;
}

.chapter-info {
  font-size: 14px;
  color: #606266;
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chapter-list-item {
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  border: 1px solid #e4e7ed;
}

.chapter-list-item:hover {
  background-color: #f5f5f5;
}

.chapter-list-item.active {
  background-color: #ecf5ff;
  border-color: #409eff;
}

.list-chapter-number {
  display: block;
  font-size: 12px;
  color: #409eff;
  font-weight: 600;
  margin-bottom: 4px;
}

.list-chapter-title {
  display: block;
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
