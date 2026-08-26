<template>
  <div class="research-result" :class="`is-${result.kind}`">
    <div class="research-header">
      <span class="research-icon">
        {{ icons[result.kind] }}
      </span>
      <div class="research-heading">
        <div class="research-title">{{ result.title }}</div>
        <div v-if="result.subtitle" class="research-subtitle">{{ result.subtitle }}</div>
      </div>
      <span v-if="result.cached" class="research-badge">缓存</span>
    </div>

    <div v-if="result.kind === 'error'" class="research-error">{{ result.message }}</div>

    <div v-else-if="result.kind === 'search'" class="source-list">
      <a
        v-for="link in result.links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="source-item"
      >
        <div class="source-title">{{ link.title }}</div>
        <div v-if="link.host" class="source-host">{{ link.host }}</div>
        <div v-if="link.summary" class="source-summary">{{ link.summary }}</div>
      </a>
      <el-empty v-if="result.links?.length === 0" description="没有解析到结果" :image-size="48" />
    </div>

    <template v-else-if="result.kind === 'article'">
      <div class="article-content">{{ result.content }}</div>
      <div v-if="result.truncated" class="research-footer">内容较长，已按上下文保护规则截断</div>
    </template>

    <div v-else-if="result.kind === 'weather'" class="weather-table">
      <div
        v-for="row in result.weather"
        :key="row.date"
        class="weather-row"
      >
        <div class="weather-date">{{ row.date }}</div>
        <div class="weather-main">{{ row.weather }}</div>
        <div class="weather-meta">{{ row.temperature }} · {{ row.precipitation }} · {{ row.wind }}</div>
      </div>
    </div>

    <div v-else-if="result.kind === 'books'" class="book-list">
      <div v-for="book in result.books" :key="book.url || book.title" class="book-item">
        <div class="book-title-row">
          <span class="book-title">{{ book.title }}</span>
          <span class="book-year">{{ book.year }}</span>
        </div>
        <div class="book-meta">{{ book.authors }} · {{ book.languages }}</div>
        <div v-if="book.subjects.length > 0" class="book-subjects">{{ book.subjects.join(' · ') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ResearchResultView } from '../utils/researchResults';

defineProps<{ result: ResearchResultView }>();

const icons: Record<ResearchResultView['kind'], string> = {
  search: '🔍',
  article: '📄',
  weather: '🌤️',
  books: '📚',
  error: '⚠️',
};
</script>

<style scoped>
.research-result {
  padding: 10px;
  border: 1px solid #d9ecff;
  border-left: 3px solid #409eff;
  border-radius: 6px;
  background: #f7fbff;
}

.research-result.is-error {
  border-color: #fde2e2;
  border-left-color: #f56c6c;
  background: #fef7f7;
}

.research-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.research-icon {
  font-size: 16px;
  line-height: 22px;
}

.research-heading {
  min-width: 0;
  flex: 1;
}

.research-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.research-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: #606266;
}

.research-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 11px;
}

.research-error {
  color: #c45656;
  font-size: 12px;
  line-height: 1.6;
}

.source-list {
  display: grid;
  gap: 6px;
}

.source-item {
  padding: 8px;
  border-radius: 5px;
  background: #fff;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.source-item:hover {
  border-color: #a0cfff;
  box-shadow: 0 2px 8px rgba(32, 86, 148, 0.1);
}

.source-title {
  color: #303133;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.source-host {
  margin-top: 2px;
  color: #409eff;
  font-size: 11px;
}

.source-summary {
  margin-top: 4px;
  color: #606266;
  font-size: 12px;
  line-height: 1.5;
}

.article-content {
  max-height: 280px;
  padding: 8px;
  overflow-y: auto;
  border-radius: 5px;
  background: #fff;
  color: #303133;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.research-footer,
.book-meta,
.book-subjects,
.weather-meta {
  color: #606266;
  font-size: 11px;
}

.research-footer {
  margin-top: 6px;
}

.weather-table {
  display: grid;
  gap: 4px;
}

.weather-row {
  display: grid;
  grid-template-columns: 84px 88px 1fr;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 5px;
  background: #fff;
  font-size: 12px;
}

.weather-date {
  color: #606266;
}

.weather-main {
  color: #303133;
  font-weight: 600;
}

.weather-meta {
  text-align: right;
}

.book-list {
  display: grid;
  gap: 6px;
}

.book-item {
  padding: 8px;
  border-radius: 5px;
  background: #fff;
}

.book-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.book-title {
  color: #303133;
  font-size: 13px;
  font-weight: 600;
}

.book-year {
  color: #909399;
  font-size: 11px;
}

.book-meta,
.book-subjects {
  margin-top: 3px;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .weather-row {
    grid-template-columns: 1fr;
    text-align: left;
  }

  .weather-meta {
    text-align: left;
  }
}
</style>
