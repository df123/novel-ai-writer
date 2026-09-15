<template>
  <div class="illustration-panel">
    <div class="panel-header">
      <span class="panel-title">AI 插画</span>
      <div class="header-actions">
        <el-select
          v-model="filterChapterId"
          placeholder="全部章节"
          clearable
          size="default"
          class="chapter-filter"
          @change="loadIllustrations"
        >
          <el-option
            v-for="chapter in sortedChapters"
            :key="chapter.id"
            :label="`第${chapter.chapterNumber}章 ${chapter.title}`"
            :value="chapter.id"
          />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="handleOpenGenerateDialog">
          生成插画
        </el-button>
      </div>
    </div>

    <div class="panel-content">
      <div v-if="isLoading" class="loading-state">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <el-empty v-else-if="illustrations.length === 0" description="暂无插画，点击右上角生成" :image-size="80" />
      <div v-else class="image-grid">
        <div v-for="item in illustrations" :key="item.id" class="image-card">
          <el-image
            :src="illustrationApi.imageUrl(item.id)"
            fit="cover"
            class="card-image"
            :preview-src-list="[illustrationApi.imageUrl(item.id)]"
            preview-teleported
            hide-on-click-modal
          >
            <template #error>
              <div class="image-error">加载失败</div>
            </template>
          </el-image>
          <div class="card-body">
            <div class="card-prompt" :title="item.prompt">{{ item.prompt }}</div>
            <div class="card-meta">
              <el-tag size="small" type="info">{{ chapterLabel(item.chapterId) }}</el-tag>
              <span class="card-date">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
          <div class="card-actions">
            <el-button size="small" text :icon="RefreshRight" title="用相同提示词重新生成" @click="handleRegenerate(item)" />
            <el-button size="small" text type="danger" :icon="Delete" title="删除" @click="handleDelete(item)" />
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="generateDialogVisible"
      title="生成插画"
      width="640px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form label-width="80px">
        <el-form-item label="关联章节">
          <el-select v-model="generateChapterId" placeholder="选择章节" clearable class="full-width">
            <el-option
              v-for="chapter in sortedChapters"
              :key="chapter.id"
              :label="`第${chapter.chapterNumber}章 ${chapter.title}`"
              :value="chapter.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="画面数量">
          <el-select v-model="sceneCount" style="width: 120px;">
            <el-option v-for="n in 5" :key="n" :label="`${n} 个`" :value="n" />
          </el-select>
          <el-button
            style="margin-left: 12px;"
            :loading="isExtracting"
            :disabled="!generateChapterId"
            @click="handleExtractScenes"
          >
            AI 提取场景
          </el-button>
        </el-form-item>
        <el-form-item label="画风后缀">
          <el-input v-model="styleHint" placeholder="统一画风,如:东方玄幻,水墨质感,电影级光影(可留空)" />
        </el-form-item>
        <el-form-item label="尺寸">
          <el-select v-model="generateSize" style="width: 180px;">
            <el-option label="方形 1024×1024" value="1024x1024" />
            <el-option label="竖版 1024×1536" value="1024x1536" />
            <el-option label="横版 1536×1024" value="1536x1024" />
          </el-select>
        </el-form-item>
        <el-form-item label="画面提示词">
          <div class="prompt-list">
            <div v-for="(prompt, index) in generatePrompts" :key="index" class="prompt-row">
              <el-input
                v-model="generatePrompts[index]"
                type="textarea"
                :rows="2"
                :placeholder="`画面 ${index + 1} 描述`"
              />
              <el-button
                :icon="Delete"
                circle
                text
                type="danger"
                size="small"
                @click="generatePrompts.splice(index, 1)"
              />
            </div>
            <el-button size="small" :icon="Plus" @click="generatePrompts.push('')">添加画面</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="generate-footer">
          <span v-if="generatingProgress" class="generating-progress">{{ generatingProgress }}</span>
          <el-button @click="generateDialogVisible = false" :disabled="isGenerating">取消</el-button>
          <el-button
            type="primary"
            :loading="isGenerating"
            :disabled="validPrompts.length === 0"
            @click="handleGenerate"
          >
            开始生成
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Plus, Delete, Loading, RefreshRight } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { illustrationApi } from '../utils/api';
import { extractScenePrompts } from '../utils/llmExtract';
import { useProjectStore } from '../stores/projectStore';
import { useChapterStore } from '../stores/chapterStore';
import type { Illustration } from '@shared/types';

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const projectStore = useProjectStore();
const chapterStore = useChapterStore();

const illustrations = ref<Illustration[]>([]);
const isLoading = ref(false);
const filterChapterId = ref<string>('');

const generateDialogVisible = ref(false);
const generateChapterId = ref<string>('');
const sceneCount = ref(3);
const styleHint = ref('东方玄幻,水墨质感,电影级光影');
const generateSize = ref('1024x1024');
const generatePrompts = ref<string[]>([]);
const isExtracting = ref(false);
const isGenerating = ref(false);
const generatingProgress = ref('');

const sortedChapters = computed(() =>
  [...chapterStore.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
);

const validPrompts = computed(() => generatePrompts.value.map(p => p.trim()).filter(Boolean));

const loadIllustrations = async () => {
  if (!projectStore.currentProject) return;
  isLoading.value = true;
  try {
    const response = await illustrationApi.list(projectStore.currentProject.id, filterChapterId.value);
    illustrations.value = response.data;
  } catch (error) {
    console.error('加载插画列表失败:', error);
    ElMessage.error('加载插画列表失败');
  } finally {
    isLoading.value = false;
  }
};

const chapterLabel = (chapterId?: string | null): string => {
  if (!chapterId) return '未关联章节';
  const chapter = chapterStore.chapters.find(c => c.id === chapterId);
  return chapter ? `第${chapter.chapterNumber}章` : '已删除章节';
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
};

const handleOpenGenerateDialog = () => {
  generateDialogVisible.value = true;
};

const handleExtractScenes = async () => {
  const chapter = chapterStore.chapters.find(c => c.id === generateChapterId.value);
  if (!chapter || !chapter.content) {
    ElMessage.warning('该章节没有内容');
    return;
  }
  isExtracting.value = true;
  try {
    const prompts = await extractScenePrompts(chapter.content, sceneCount.value, styleHint.value);
    generatePrompts.value = prompts;
  } catch (error) {
    console.error('提取场景失败:', error);
    ElMessage.error(error instanceof Error ? error.message : '提取场景失败,请手动填写');
  } finally {
    isExtracting.value = false;
  }
};

const handleGenerate = async () => {
  if (!projectStore.currentProject || validPrompts.value.length === 0) return;
  isGenerating.value = true;
  const [width, height] = generateSize.value.split('x').map(Number);
  let successCount = 0;
  try {
    for (let i = 0; i < validPrompts.value.length; i++) {
      generatingProgress.value = `正在生成第 ${i + 1}/${validPrompts.value.length} 张...`;
      try {
        await illustrationApi.generate({
          projectId: projectStore.currentProject.id,
          chapterId: generateChapterId.value || null,
          prompt: validPrompts.value[i],
          width,
          height,
        });
        successCount++;
      } catch (error) {
        console.error('生成插画失败:', error);
        // 优先显示服务端返回的友好文案(如"无法连接生图服务…"),退回 axios/通用错误
        const serverMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
        ElMessage.error(serverMessage || (error instanceof Error ? error.message : `第 ${i + 1} 张生成失败`));
      }
    }
    if (successCount > 0) {
      ElMessage.success(`已生成 ${successCount} 张插画`);
      await loadIllustrations();
    }
  } finally {
    isGenerating.value = false;
    generatingProgress.value = '';
    if (successCount > 0) {
      generateDialogVisible.value = false;
    }
  }
};

const handleRegenerate = async (item: Illustration) => {
  if (!projectStore.currentProject) return;
  try {
    await ElMessageBox.confirm('用相同提示词重新生成一张?', '重新生成', {
      confirmButtonText: '生成',
      cancelButtonText: '取消',
      type: 'info',
    });
  } catch {
    return;
  }
  try {
    await illustrationApi.generate({
      projectId: item.projectId,
      chapterId: item.chapterId,
      prompt: item.prompt,
      width: item.width,
      height: item.height,
    });
    ElMessage.success('已生成新插画');
    await loadIllustrations();
  } catch (error) {
    console.error('重新生成失败:', error);
    ElMessage.error(error instanceof Error ? error.message : '重新生成失败');
  }
};

const handleDelete = async (item: Illustration) => {
  try {
    await ElMessageBox.confirm('确定删除这张插画?', '删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await illustrationApi.remove(item.id);
    await loadIllustrations();
  } catch (error) {
    console.error('删除插画失败:', error);
    ElMessage.error('删除失败');
  }
};

const close = () => emit('update:modelValue', false);

defineExpose({ loadIllustrations });

loadIllustrations();
</script>

<style scoped>
.illustration-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e4e7ed;
  background: #f5f7fa;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chapter-filter {
  width: 240px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 0;
  color: #909399;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.image-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: box-shadow 0.2s;
}

.image-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-image {
  width: 100%;
  height: 220px;
  display: block;
  cursor: zoom-in;
  background: #f5f7fa;
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #c0c4cc;
}

.card-body {
  padding: 10px 12px 6px;
}

.card-prompt {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  height: 36px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.card-date {
  font-size: 11px;
  color: #c0c4cc;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 8px 8px;
  gap: 4px;
}

.full-width {
  width: 100%;
}

.prompt-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.generate-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.generating-progress {
  font-size: 13px;
  color: #e6a23c;
  margin-right: auto;
}
</style>
