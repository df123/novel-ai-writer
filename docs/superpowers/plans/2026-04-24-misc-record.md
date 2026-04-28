# 杂项记录（MiscRecord）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增杂项记录模块，用于记录小说中各类设定（功法、星球、城市等），支持分类筛选、搜索、版本历史和回收站。

**Architecture:** 完全遵循项目现有的 6 层架构模式（类型定义 → 数据库 Schema → 后端路由 → 格式化器 → 前端 API → Store → 组件）。与时间线/人物模块结构一致，使用弹窗交互。

**Tech Stack:** TypeScript, Express.js, sql.js (SQLite), Vue 3 + Composition API, Pinia, Element Plus

---

## File Structure

### 新建文件
| 文件 | 职责 |
|------|------|
| `src/server/routes/miscRecords.ts` | 后端 CRUD + 软删除 + 版本管理路由 |
| `src/renderer/stores/miscRecordStore.ts` | Pinia Store，管理杂项记录状态 |
| `src/renderer/components/MiscRecordPanel.vue` | 弹窗组件，记录列表 + 编辑区 |

### 修改文件
| 文件 | 修改内容 |
|------|---------|
| `src/shared/types.ts` | 添加 MiscRecord 系列接口 |
| `src/server/db/schema.ts` | 添加建表 SQL 和索引 |
| `src/server/index.ts` | 注册 miscRecords 路由 |
| `src/server/utils/formatters.ts` | 添加 formatMiscRecord 函数 |
| `src/renderer/utils/api.ts` | 添加 miscRecordApi 对象 |
| `src/renderer/components/MainLayout.vue` | 添加按钮和弹窗集成 |

---

### Task 1: 添加共享类型定义

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: 在 shared/types.ts 中添加 MiscRecord 相关接口**

在文件末尾（`DbSetting` 接口之后）添加以下接口定义：

```typescript
// ===== 杂项记录（MiscRecord）类型 =====

export interface MiscRecord {
  id: string;
  projectId: string;
  title: string;
  category: string;
  content: string;
  orderIndex: number;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
}

export interface MiscRecordVersion {
  id: string;
  miscRecordId: string;
  title: string;
  category: string;
  content: string;
  version: number;
  createdAt: number;
}

export interface DbMiscRecord {
  id: string;
  project_id: string;
  title: string;
  category: string;
  content: string;
  order_index: number;
  created_at: number;
  updated_at: number;
  deleted: number;
  deleted_at: number | null;
}

export interface DbMiscRecordVersion {
  id: string;
  misc_record_id: string;
  title: string;
  category: string;
  content: string;
  version: number;
  created_at: number;
}
```

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/shared/types.ts
git commit -m "feat: add MiscRecord type definitions"
```

---

### Task 2: 添加数据库 Schema

**Files:**
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: 在 schema.ts 的 migrations 数组中添加 misc_records 和 misc_record_versions 建表 SQL**

参考现有的 timeline_nodes 和 timeline_versions 表写法。在 migrations 数组的最后一个 migration 对象中，up 数组末尾添加以下 SQL：

```typescript
// misc_records 表
'CREATE TABLE IF NOT EXISTS misc_records (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT \'\', content TEXT, order_index INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER DEFAULT NULL, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE)',

// misc_record_versions 表
'CREATE TABLE IF NOT EXISTS misc_record_versions (id TEXT PRIMARY KEY, misc_record_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT \'\', content TEXT, version INTEGER NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (misc_record_id) REFERENCES misc_records(id) ON DELETE CASCADE)',

// 索引
'CREATE INDEX IF NOT EXISTS idx_misc_records_project_id ON misc_records(project_id)',
'CREATE INDEX IF NOT EXISTS idx_misc_records_deleted ON misc_records(deleted)',
'CREATE INDEX IF NOT EXISTS idx_misc_records_deleted_at ON misc_records(deleted_at)',
'CREATE INDEX IF NOT EXISTS idx_misc_record_versions_record_id ON misc_record_versions(misc_record_id)',
'CREATE INDEX IF NOT EXISTS idx_misc_records_category ON misc_records(project_id, category)',
```

注意：要找到 migrations 数组中最新的 migration（version 数字最大的那个），在其 up 数组中追加上述语句。

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/server/db/schema.ts
git commit -m "feat: add misc_records database schema"
```

---

### Task 3: 添加格式化器

**Files:**
- Modify: `src/server/utils/formatters.ts`

- [ ] **Step 1: 在 formatters.ts 末尾添加 formatMiscRecord 函数**

参考现有的 formatTimelineNode 函数写法。需要先在文件顶部 import 区域添加 `DbMiscRecord, MiscRecord` 类型的导入。

```typescript
export function formatMiscRecord(record: DbMiscRecord): MiscRecord {
  return {
    id: record.id,
    projectId: record.project_id,
    title: record.title,
    category: record.category || '',
    content: record.content || '',
    orderIndex: record.order_index,
    createdAt: record.created_at,
    deleted: record.deleted === 1,
    deletedAt: record.deleted_at ?? undefined,
  };
}
```

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/server/utils/formatters.ts
git commit -m "feat: add formatMiscRecord formatter"
```

---

### Task 4: 创建后端路由

**Files:**
- Create: `src/server/routes/miscRecords.ts`

- [ ] **Step 1: 创建 miscRecords.ts 路由文件**

参考 `src/server/routes/characters.ts` 的完整结构创建新文件。路由文件需要：

1. 导入 express.Router()
2. 导入数据库辅助函数 query/run
3. 导入 helpers (generateId, now)
4. 导入 formatMiscRecord
5. 导入类型 (DbMiscRecord, DbMiscRecordVersion, MiscRecord)

实现以下路由：

**GET /projects/:projectId/misc-records** - 列表（支持 search 和 category 查询参数）
```typescript
router.get('/projects/:projectId/misc-records', async (req, res) => {
  // 获取项目下未删除的记录
  // 支持 ?search=xxx 搜索标题和内容
  // 支持 ?category=xxx 按分类筛选
  // 按 order_index 排序
  // 返回格式化后的数组
});
```

**POST /projects/:projectId/misc-records** - 创建
```typescript
router.post('/projects/:projectId/misc-records', async (req, res) => {
  // 从 body 获取 title, category, content
  // 计算 order_index (当前最大值 + 1)
  // 插入 misc_records 表
  // 返回格式化后的记录
});
```

**GET /misc-records/:id** - 获取单条
```typescript
router.get('/misc-records/:id', async (req, res) => {
  // 按 id 查询
  // 返回格式化后的记录
});
```

**PUT /misc-records/:id** - 更新（支持 createVersion 创建版本快照）
```typescript
router.put('/misc-records/:id', async (req, res) => {
  // 从 body 获取 title, category, content, createVersion
  // 如果 createVersion 为 true：
  //   1. 查询当前记录
  //   2. 查询当前最大版本号
  //   3. 插入 misc_record_versions 表
  // 更新 misc_records 表
  // 返回格式化后的记录
});
```

**DELETE /misc-records/:id** - 软删除
```typescript
router.delete('/misc-records/:id', async (req, res) => {
  // 设置 deleted = 1, deleted_at = now()
  // 返回成功消息
});
```

**POST /misc-records/:id/restore** - 恢复
```typescript
router.post('/misc-records/:id/restore', async (req, res) => {
  // 设置 deleted = 0, deleted_at = NULL
  // 返回格式化后的记录
});
```

**DELETE /misc-records/:id/permanent** - 永久删除
```typescript
router.delete('/misc-records/:id/permanent', async (req, res) => {
  // 仅允许删除已软删除的记录
  // 真正从数据库删除
  // 返回成功消息
});
```

**GET /projects/:projectId/misc-records/trash** - 回收站
```typescript
router.get('/projects/:projectId/misc-records/trash', async (req, res) => {
  // 查询已软删除的记录
  // 返回格式化后的数组
});
```

**GET /misc-records/:recordId/versions** - 版本历史
```typescript
router.get('/misc-records/:recordId/versions', async (req, res) => {
  // 查询 misc_record_versions 表
  // 按 version DESC 排序
  // 返回版本数组
});
```

**POST /misc-records/:recordId/versions/:versionId/restore** - 恢复到指定版本
```typescript
router.post('/misc-records/:recordId/versions/:versionId/restore', async (req, res) => {
  // 查询指定版本内容
  // 用版本内容更新主记录
  // 返回格式化后的记录
});
```

最后导出 router：
```typescript
export default router;
```

请严格参照 `src/server/routes/characters.ts` 的代码风格和模式编写，保持错误处理、响应格式等完全一致。

- [ ] **Step 2: 在 server/index.ts 中注册路由**

在 `src/server/index.ts` 中添加：
1. 在 import 区域添加 `import miscRecordsRouter from './routes/miscRecords';`
2. 在路由注册区域（其他 app.use 行附近）添加 `app.use('/api', miscRecordsRouter);`

- [ ] **Step 3: 验证类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/server/routes/miscRecords.ts src/server/index.ts
git commit -m "feat: add miscRecords backend routes"
```

---

### Task 5: 添加前端 API 封装

**Files:**
- Modify: `src/renderer/utils/api.ts`

- [ ] **Step 1: 在 api.ts 末尾添加 miscRecordApi 对象**

参考现有的 timelineApi 写法。在文件末尾添加：

```typescript
export const miscRecordApi = {
  list: (projectId: string, filters?: { search?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.category) params.append('category', filters.category);
    const queryString = params.toString();
    return api.get(`/projects/${projectId}/misc-records${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => api.get(`/misc-records/${id}`),
  create: (projectId: string, data: { title: string; category?: string; content?: string }) =>
    api.post(`/projects/${projectId}/misc-records`, data),
  update: (id: string, data: { title?: string; category?: string; content?: string; createVersion?: boolean }) =>
    api.put(`/misc-records/${id}`, data),
  delete: (id: string) => api.delete(`/misc-records/${id}`),
  restore: (id: string) => api.post(`/misc-records/${id}/restore`),
  permanentDelete: (id: string) => api.delete(`/misc-records/${id}/permanent`),
  getTrash: (projectId: string) => api.get(`/projects/${projectId}/misc-records/trash`),
  getVersions: (recordId: string) => api.get(`/misc-records/${recordId}/versions`),
  restoreVersion: (recordId: string, versionId: string) =>
    api.post(`/misc-records/${recordId}/versions/${versionId}/restore`),
};
```

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/renderer/utils/api.ts
git commit -m "feat: add miscRecordApi frontend API"
```

---

### Task 6: 创建 Pinia Store

**Files:**
- Create: `src/renderer/stores/miscRecordStore.ts`

- [ ] **Step 1: 创建 miscRecordStore.ts**

参考 `src/renderer/stores/characterStore.ts` 的完整结构。使用 Pinia Composition API 风格：

```typescript
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { miscRecordApi } from '../utils/api';
import type { MiscRecord, MiscRecordVersion } from '@shared/types';

export const useMiscRecordStore = defineStore('miscRecord', () => {
  // 响应式状态
  const records = ref<MiscRecord[]>([]);
  const selectedRecord = ref<MiscRecord | null>(null);
  const isLoading = ref(false);
  const versions = ref<Map<string, MiscRecordVersion[]>>(new Map());
  const isLoadingVersions = ref(false);
  const searchQuery = ref('');
  const selectedCategory = ref('');

  // 获取所有分类（从当前记录中提取去重）
  const categories = computed(() => {
    const cats = new Set(records.value.map(r => r.category).filter(Boolean));
    return Array.from(cats).sort();
  });

  // 加载记录列表
  async function loadRecords(projectId: string) {
    isLoading.value = true;
    try {
      const filters: { search?: string; category?: string } = {};
      if (searchQuery.value) filters.search = searchQuery.value;
      if (selectedCategory.value) filters.category = selectedCategory.value;
      const { data } = await miscRecordApi.list(projectId, filters);
      records.value = data;
    } catch (error) {
      console.error('加载杂项记录失败:', error);
    } finally {
      isLoading.value = false;
    }
  }

  // 创建记录
  async function createRecord(projectId: string, data: { title: string; category?: string; content?: string }) {
    try {
      const { data: newRecord } = await miscRecordApi.create(projectId, data);
      records.value.push(newRecord);
      selectedRecord.value = newRecord;
      return newRecord;
    } catch (error) {
      console.error('创建杂项记录失败:', error);
      throw error;
    }
  }

  // 更新记录
  async function updateRecord(id: string, data: { title?: string; category?: string; content?: string }) {
    try {
      const { data: updated } = await miscRecordApi.update(id, { ...data, createVersion: true });
      const index = records.value.findIndex(r => r.id === id);
      if (index !== -1) records.value[index] = updated;
      if (selectedRecord.value?.id === id) selectedRecord.value = updated;
      return updated;
    } catch (error) {
      console.error('更新杂项记录失败:', error);
      throw error;
    }
  }

  // 删除记录（软删除）
  async function deleteRecord(id: string) {
    try {
      await miscRecordApi.delete(id);
      records.value = records.value.filter(r => r.id !== id);
      if (selectedRecord.value?.id === id) selectedRecord.value = null;
    } catch (error) {
      console.error('删除杂项记录失败:', error);
      throw error;
    }
  }

  // 选择记录
  function selectRecord(record: MiscRecord | null) {
    selectedRecord.value = record;
  }

  // 加载版本历史
  async function loadVersions(recordId: string) {
    isLoadingVersions.value = true;
    try {
      const { data } = await miscRecordApi.getVersions(recordId);
      versions.value.set(recordId, data);
    } catch (error) {
      console.error('加载版本历史失败:', error);
    } finally {
      isLoadingVersions.value = false;
    }
  }

  // 获取版本历史（缓存优先）
  function getVersions(recordId: string): MiscRecordVersion[] {
    return versions.value.get(recordId) || [];
  }

  // 恢复版本
  async function restoreVersion(recordId: string, versionId: string) {
    try {
      const { data: restored } = await miscRecordApi.restoreVersion(recordId, versionId);
      const index = records.value.findIndex(r => r.id === recordId);
      if (index !== -1) records.value[index] = restored;
      if (selectedRecord.value?.id === recordId) selectedRecord.value = restored;
      return restored;
    } catch (error) {
      console.error('恢复版本失败:', error);
      throw error;
    }
  }

  // 恢复已删除记录
  async function restoreRecord(id: string) {
    try {
      const { data: restored } = await miscRecordApi.restore(id);
      records.value = records.value.filter(r => r.id !== id);
      return restored;
    } catch (error) {
      console.error('恢复记录失败:', error);
      throw error;
    }
  }

  // 永久删除
  async function permanentDelete(id: string) {
    try {
      await miscRecordApi.permanentDelete(id);
      records.value = records.value.filter(r => r.id !== id);
    } catch (error) {
      console.error('永久删除失败:', error);
      throw error;
    }
  }

  // 加载回收站
  async function loadTrash(projectId: string) {
    isLoading.value = true;
    try {
      const { data } = await miscRecordApi.getTrash(projectId);
      records.value = data;
    } catch (error) {
      console.error('加载回收站失败:', error);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    records,
    selectedRecord,
    isLoading,
    versions,
    isLoadingVersions,
    searchQuery,
    selectedCategory,
    categories,
    loadRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    selectRecord,
    loadVersions,
    getVersions,
    restoreVersion,
    restoreRecord,
    permanentDelete,
    loadTrash,
  };
});
```

请参照 characterStore.ts 的代码风格，确保完全一致。

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/renderer/stores/miscRecordStore.ts
git commit -m "feat: add miscRecord Pinia store"
```

---

### Task 7: 创建弹窗组件

**Files:**
- Create: `src/renderer/components/MiscRecordPanel.vue`

- [ ] **Step 1: 创建 MiscRecordPanel.vue 组件**

参考 `src/renderer/components/CharacterPanel.vue` 的整体结构和代码风格，创建弹窗组件。

组件设计要求：

**Props:**
```typescript
const props = defineProps<{
  modelValue: boolean;  // 控制弹窗显示/隐藏
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
```

**模板结构：**
```html
<el-dialog
  :model-value="modelValue"
  @update:model-value="emit('update:modelValue', $event)"
  title="杂项记录"
  width="900px"
  :close-on-click-modal="false"
  destroy-on-close
>
  <el-container style="height: 600px;">
    <!-- 左侧：记录列表 -->
    <el-aside width="300px" style="border-right: 1px solid var(--el-border-color); padding: 10px;">
      <!-- 搜索框 -->
      <el-input v-model="searchQuery" placeholder="搜索记录..." clearable prefix-icon="Search" />
      
      <!-- 分类筛选 -->
      <el-select v-model="selectedCategory" placeholder="全部分类" clearable style="width: 100%; margin-top: 8px;">
        <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
      </el-select>

      <!-- Tab 切换：记录列表 / 回收站 -->
      <el-tabs v-model="activeTab" style="margin-top: 10px;">
        <el-tab-pane label="记录" name="list">
          <!-- 新建按钮 -->
          <el-button type="primary" style="width: 100%; margin-bottom: 8px;" @click="handleCreate">
            新建记录
          </el-button>
          <!-- 记录列表 -->
          <div v-loading="isLoading">
            <div
              v-for="record in records"
              :key="record.id"
              :class="['record-item', { active: selectedRecord?.id === record.id }]"
              @click="handleSelectRecord(record)"
              style="padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 4px;"
            >
              <div style="font-weight: 500;">{{ record.title }}</div>
              <el-tag v-if="record.category" size="small" type="info" style="margin-top: 4px;">
                {{ record.category }}
              </el-tag>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="回收站" name="trash">
          <!-- 回收站记录列表 -->
          <div v-loading="isLoading">
            <div
              v-for="record in trashRecords"
              :key="record.id"
              style="padding: 8px; border-radius: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;"
            >
              <div>
                <div style="font-weight: 500;">{{ record.title }}</div>
                <el-tag v-if="record.category" size="small" type="info">{{ record.category }}</el-tag>
              </div>
              <div>
                <el-button size="small" type="primary" @click="handleRestore(record)">恢复</el-button>
                <el-button size="small" type="danger" @click="handlePermanentDelete(record)">永久删除</el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-aside>

    <!-- 右侧：编辑区 -->
    <el-main style="padding: 20px;">
      <div v-if="selectedRecord">
        <!-- 标题 -->
        <el-input v-model="editForm.title" placeholder="标题" style="margin-bottom: 12px;" />
        
        <!-- 分类（带自动补全） -->
        <el-autocomplete
          v-model="editForm.category"
          :fetch-suggestions="queryCategorySuggestions"
          placeholder="分类（如：功法、星球、城市）"
          clearable
          style="width: 100%; margin-bottom: 12px;"
        />

        <!-- 内容描述 -->
        <el-input
          v-model="editForm.content"
          type="textarea"
          placeholder="详细描述..."
          :rows="10"
          style="margin-bottom: 12px;"
        />

        <!-- 操作按钮 -->
        <div style="display: flex; justify-content: space-between;">
          <div>
            <el-button type="primary" @click="handleSave">保存</el-button>
            <el-button @click="handleShowVersions">版本历史</el-button>
          </div>
          <el-button type="danger" @click="handleDelete">删除</el-button>
        </div>
      </div>
      <div v-else style="text-align: center; color: var(--el-text-color-secondary); padding-top: 100px;">
        选择或创建一条记录
      </div>
    </el-main>
  </el-container>
</el-dialog>

<!-- 版本历史弹窗 -->
<el-dialog v-model="showVersions" title="版本历史" width="600px" append-to-body>
  <div v-loading="isLoadingVersions">
    <div v-for="version in currentVersions" :key="version.id" style="padding: 10px; border-bottom: 1px solid var(--el-border-color);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>版本 {{ version.version }} - {{ formatTimestamp(version.createdAt) }}</span>
        <el-button size="small" @click="handleRestoreVersion(version)">恢复此版本</el-button>
      </div>
      <div style="margin-top: 4px;"><strong>{{ version.title }}</strong></div>
      <el-tag v-if="version.category" size="small" type="info">{{ version.category }}</el-tag>
      <div style="margin-top: 4px; color: var(--el-text-color-regular);">{{ version.content }}</div>
    </div>
  </div>
</el-dialog>
```

**脚本逻辑：**
- 使用 `useMiscRecordStore()` 和 `useProjectStore()`
- 弹窗打开时加载记录列表
- 搜索和分类筛选支持防抖（300ms）
- editForm 使用 reactive({ title: '', category: '', content: '' })
- 选中记录时将记录数据复制到 editForm
- 保存时调用 store.updateRecord
- 新建时先调用 store.createRecord 创建空记录
- 删除确认使用 ElMessageBox.confirm
- 版本历史通过内嵌 el-dialog 展示
- 分类自动补全从 store.categories 获取
- 回收站切换 Tab 时加载回收站数据
- 使用 formatTimestamp 格式化时间

**样式：**
- 记录列表项 hover 和 active 状态使用 Element Plus 变量
- 使用 `var(--el-fill-color-light)` 作为 hover 背景
- 使用 `var(--el-color-primary-light-9)` 作为 active 背景

请严格参照 CharacterPanel.vue 和 ChapterPanel.vue 的代码风格编写完整组件。

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/MiscRecordPanel.vue
git commit -m "feat: add MiscRecordPanel component"
```

---

### Task 8: 集成到主布局

**Files:**
- Modify: `src/renderer/components/MainLayout.vue`

- [ ] **Step 1: 在 MainLayout.vue 中集成杂项记录功能**

具体修改：

1. **导入组件和 Store：**
```typescript
import MiscRecordPanel from './MiscRecordPanel.vue';
import { useMiscRecordStore } from '../stores/miscRecordStore';
```

2. **添加响应式状态：**
```typescript
const showMiscRecord = ref(false);
const miscRecordStore = useMiscRecordStore();
```

3. **在 Header 导航栏中添加按钮：**
找到章节管理按钮和主旨管理按钮所在位置，在附近添加：
```html
<el-button @click="showMiscRecord = true">
  <el-icon><Notebook /></el-icon>
  <span>杂项记录</span>
</el-button>
```
需要导入 Notebook 图标：`import { Notebook } from '@element-plus/icons-vue';`

4. **在模板中添加弹窗组件：**
在 MainLayout.vue 模板末尾（其他 el-dialog 附近）添加：
```html
<MiscRecordPanel v-model="showMiscRecord" />
```

- [ ] **Step 2: 验证类型检查和 lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 无错误

- [ ] **Step 3: 启动开发服务器验证**

Run: `pnpm dev`
Expected: 开发服务器启动成功，Header 中出现「杂项记录」按钮

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/MainLayout.vue
git commit -m "feat: integrate MiscRecordPanel into MainLayout"
```

---

## 验证清单

完成所有 Task 后，执行以下验证：

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm dev` 启动成功
- [ ] Header 中可见「杂项记录」按钮
- [ ] 点击按钮可打开弹窗
- [ ] 可以创建新记录（标题、分类、内容）
- [ ] 记录列表可搜索和按分类筛选
- [ ] 可以编辑和删除记录
- [ ] 删除后可在回收站中看到
- [ ] 回收站可恢复或永久删除
- [ ] 版本历史可查看和恢复
