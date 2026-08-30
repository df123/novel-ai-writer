<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="720px"
    top="6vh"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="diff-dialog-body">
      <div class="diff-meta">
        <el-tag v-if="kind" :type="kind === 'create' ? 'success' : 'warning'" size="small">
          {{ kind === 'create' ? '新增内容' : '修改对比' }}
        </el-tag>
        <el-switch
          v-model="ignoreWhitespace"
          size="small"
          active-text="忽略空白"
          @change="handleToggleIgnoreWhitespace"
        />
        <span class="diff-legend">
          <span class="legend-chip legend-remove">− 修改前</span>
          <span class="legend-chip legend-add">+ 修改后</span>
        </span>
      </div>

      <el-scrollbar max-height="65vh">
        <div
          v-for="(item, sIndex) in visibleSections"
          :key="sIndex"
          class="diff-section"
        >
          <div class="diff-section-label">{{ item.section.label }}</div>
          <div class="diff-body">
            <template v-for="(row, rIndex) in item.rows" :key="rIndex">
              <div v-if="row.kind === 'skip'" class="diff-line diff-skip">
                … 未变更的 {{ row.count }} 行 …
              </div>
              <div v-else :class="['diff-line', `is-${row.type}`]">
                <span class="diff-sign">{{ row.type === 'add' ? '+' : row.type === 'remove' ? '−' : '' }}</span>
                <span class="diff-text">{{ row.text }}</span>
              </div>
            </template>
          </div>
        </div>
        <div v-if="visibleSections.length === 0" class="diff-empty is-page-empty">
          {{ ignoreWhitespace ? '忽略空白后未发现实际内容变化' : '本次修改内容无变化' }}
        </div>
      </el-scrollbar>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { diffLines, collapseDiffRows, type DiffRow, type DiffSection } from '../utils/diff';

const props = defineProps<{
  modelValue: boolean;
  title: string;
  sections: DiffSection[];
  kind?: 'create' | 'update';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const ignoreWhitespace = ref((() => {
  try {
    const stored = localStorage.getItem('diff-ignore-whitespace');
    return stored !== null ? (JSON.parse(stored) as boolean) : true;
  } catch {
    return true;
  }
})());

const handleToggleIgnoreWhitespace = () => {
  localStorage.setItem('diff-ignore-whitespace', JSON.stringify(ignoreWhitespace.value));
};

const visibleSections = computed<Array<{ section: DiffSection; rows: DiffRow[] }>>(() => {
  const rowsPerSection = props.sections.map(section =>
    collapseDiffRows(diffLines(section.before, section.after, { ignoreWhitespace: ignoreWhitespace.value }))
  );
  return props.sections
    .map((section, index) => ({ section, rows: rowsPerSection[index] ?? [] }))
    .filter(item => item.rows.some(row => row.kind === 'line' && row.type !== 'equal'));
});
</script>

<style scoped>
.diff-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.diff-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.diff-legend {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.legend-chip {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
}

.legend-remove {
  background-color: #fef0f0;
  color: #c45656;
}

.legend-add {
  background-color: #f0f9eb;
  color: #529b2e;
}

.diff-section {
  margin-bottom: 12px;
}

.diff-section-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.diff-body {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12.5px;
  line-height: 1.6;
}

.diff-line {
  display: flex;
  min-height: 21px;
  padding: 0 8px;
}

.diff-sign {
  width: 18px;
  flex-shrink: 0;
  user-select: none;
}

.diff-text {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-all;
}

.is-equal {
  color: #606266;
  background-color: #fafafa;
}

.is-remove {
  color: #c45656;
  background-color: #fef0f0;
}

.is-add {
  color: #529b2e;
  background-color: #f0f9eb;
}

.diff-skip {
  justify-content: center;
  color: #909399;
  background-color: #f5f7fa;
  font-size: 12px;
  padding: 2px 0;
}

.diff-empty {
  padding: 12px;
  color: #909399;
  text-align: center;
}

.is-page-empty {
  padding: 40px 0;
}
</style>
