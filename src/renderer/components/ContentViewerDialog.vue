<template>
  <el-dialog
    v-model="visible"
    width="720px"
    append-to-body
    destroy-on-close
    class="content-viewer-dialog"
  >
    <template #header>
      <div class="viewer-header">
        <div class="viewer-header-main">
          <p v-if="subtitle" class="viewer-eyebrow">{{ subtitle }}</p>
          <h3 class="viewer-title">{{ title }}</h3>
        </div>
        <div v-if="tags.length > 0" class="viewer-tags">
          <el-tag v-for="tag in tags" :key="tag" size="small" effect="light">
            {{ tag }}
          </el-tag>
        </div>
      </div>
    </template>

    <div class="viewer-shell">
      <div v-if="deletedText" class="viewer-deleted">
        {{ deletedText }}
      </div>

      <el-scrollbar max-height="54vh" class="viewer-scrollbar">
        <section
          v-for="section in renderedSections"
          :key="section.label"
          class="viewer-section"
        >
          <div class="section-header">
            <span class="section-label">{{ section.label }}</span>
          </div>
          <div
            v-if="section.content && section.markdown"
            class="section-content markdown-content"
            v-html="section.html"
          />
          <div v-else-if="section.content" class="section-content">
            {{ section.content }}
          </div>
          <div v-else class="section-empty">
            {{ section.emptyText || '暂无内容' }}
          </div>
        </section>
      </el-scrollbar>
    </div>

    <template #footer>
      <div class="viewer-footer">
        <div class="footer-actions">
          <slot name="actions" />
        </div>
        <div class="footer-buttons">
          <el-button v-if="editable" type="primary" :icon="Edit" @click="handleEdit">
            编辑
          </el-button>
          <el-button @click="visible = false">关闭</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Edit } from '@element-plus/icons-vue';
import { marked } from 'marked';

interface ContentViewerSection {
  label: string;
  content?: string;
  markdown?: boolean;
  emptyText?: string;
}

interface Props {
  modelValue: boolean;
  title: string;
  subtitle?: string;
  tags?: string[];
  sections?: ContentViewerSection[];
  deletedText?: string;
  editable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  tags: () => [],
  sections: () => [],
  deletedText: '',
  editable: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit'): void;
}>();

marked.setOptions({
  breaks: true,
  gfm: true
});

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
});

const renderedSections = computed(() => props.sections.map(section => ({
  ...section,
  html: renderMarkdown(section.content || '')
})));

function renderMarkdown(content: string): string {
  try {
    return marked(content);
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return content;
  }
}

function handleEdit() {
  emit('edit');
  visible.value = false;
}
</script>

<style scoped>
.viewer-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.viewer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-right: 24px;
}

.viewer-header-main {
  min-width: 0;
  flex: 1;
}

.viewer-eyebrow {
  margin: 0 0 6px;
  color: #409eff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.viewer-title {
  margin: 0;
  color: #303133;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  word-break: break-word;
}

.viewer-tags {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.viewer-deleted {
  padding: 10px 14px;
  border: 1px solid #f3d19e;
  border-radius: 8px;
  background: #fdf6ec;
  color: #b25e00;
  font-size: 13px;
}

.viewer-scrollbar {
  border-radius: 12px;
}

.viewer-section {
  padding: 18px 20px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(48, 49, 51, 0.04);
}

.viewer-section + .viewer-section {
  margin-top: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.section-label {
  color: #606266;
  font-size: 13px;
  font-weight: 700;
}

.section-header::before {
  content: '';
  display: block;
  width: 3px;
  height: 14px;
  margin-right: 8px;
  border-radius: 2px;
  background: linear-gradient(180deg, #409eff 0%, #79bbff 100%);
}

.section-content {
  color: #303133;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.markdown-content :deep(p) {
  margin: 0.7em 0;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin: 1.2em 0 0.5em;
  color: #303133;
  font-weight: 700;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.7em 0;
  padding-left: 1.8em;
}

.markdown-content :deep(blockquote) {
  margin: 1em 0;
  padding: 10px 14px;
  border-left: 3px solid #409eff;
  border-radius: 6px;
  background: #f5f9ff;
  color: #606266;
}

.markdown-content :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #f4f4f5;
  color: #c7254e;
  font-family: Consolas, Monaco, monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  margin: 1em 0;
  padding: 14px;
  border-radius: 8px;
  background: #282c34;
  color: #abb2bf;
  overflow-x: auto;
}

.section-empty {
  padding: 18px;
  border-radius: 8px;
  background: #fafafa;
  color: #909399;
  font-size: 13px;
  text-align: center;
}

.viewer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.footer-buttons {
  display: flex;
  gap: 8px;
}
</style>
