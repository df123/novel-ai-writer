# 杂物记录模块设计文档

## 概述

杂物记录（MiscRecord）模块用于记录小说中各种设定信息，如修仙小说的功法、太空类型的星球特性、城市、法宝、势力等。该模块采用与时间线和人物模块完全一致的架构模式，通过弹窗方式呈现。

## 需求

- 用户可以创建、编辑、删除杂物记录
- 每条记录包含标题、分类（自定义标签）、内容描述三个核心字段
- 支持按分类筛选记录
- 支持搜索（标题和内容）
- 支持版本历史，可查看和恢复历史版本
- 支持软删除和回收站
- 通过 Header 按钮打开弹窗管理

## 数据模型

### 前端类型（MiscRecord）

```typescript
interface MiscRecord {
  id: string;
  projectId: string;
  title: string;
  category: string;        // 自定义分类标签（如"功法"、"星球"、"城市"）
  content: string;         // 详细描述
  orderIndex: number;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
}

interface MiscRecordVersion {
  id: string;
  miscRecordId: string;
  title: string;
  category: string;
  content: string;
  version: number;
  createdAt: number;
}
```

### 数据库类型（DbMiscRecord）

```typescript
interface DbMiscRecord {
  id: string;
  project_id: string;
  title: string;
  category: string;
  content: string;
  order_index: number;
  created_at: number;
  updated_at: number;
  deleted: number;         // 0 or 1
  deleted_at: number | null;
}

interface DbMiscRecordVersion {
  id: string;
  misc_record_id: string;
  title: string;
  category: string;
  content: string;
  version: number;
  created_at: number;
}
```

### 数据库表结构

#### misc_records 表

```sql
CREATE TABLE IF NOT EXISTS misc_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  content TEXT,
  order_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER DEFAULT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

#### misc_record_versions 表

```sql
CREATE TABLE IF NOT EXISTS misc_record_versions (
  id TEXT PRIMARY KEY,
  misc_record_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  content TEXT,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (misc_record_id) REFERENCES misc_records(id) ON DELETE CASCADE
);
```

#### 索引

```sql
CREATE INDEX IF NOT EXISTS idx_misc_records_project_id ON misc_records(project_id);
CREATE INDEX IF NOT EXISTS idx_misc_records_deleted ON misc_records(deleted);
CREATE INDEX IF NOT EXISTS idx_misc_records_deleted_at ON misc_records(deleted_at);
CREATE INDEX IF NOT EXISTS idx_misc_record_versions_record_id ON misc_record_versions(misc_record_id);
CREATE INDEX IF NOT EXISTS idx_misc_records_category ON misc_records(project_id, category);
```

## API 设计

| HTTP | 路径 | 功能 |
|------|------|------|
| GET | `/projects/:projectId/misc-records` | 获取项目杂物记录（支持 title/content 搜索，category 筛选） |
| POST | `/projects/:projectId/misc-records` | 创建记录 |
| PUT | `/misc-records/:id` | 更新记录（支持 createVersion） |
| DELETE | `/misc-records/:id` | 软删除记录 |
| POST | `/misc-records/:id/restore` | 恢复已删除记录 |
| DELETE | `/misc-records/:id/permanent` | 永久删除 |
| GET | `/projects/:projectId/misc-records/trash` | 获取回收站 |
| GET | `/misc-records/:id` | 获取单条记录 |
| GET | `/misc-records/:recordId/versions` | 获取版本历史 |
| POST | `/misc-records/:recordId/versions/:versionId/restore` | 恢复到指定版本 |

## UI 设计

### 入口
- 在 MainLayout.vue 的 Header 导航栏中添加「杂物记录」按钮
- 按钮样式与「章节管理」「主旨管理」按钮保持一致
- 使用 Element Plus 的 `Notebook` 图标

### 弹窗布局
弹窗使用 `el-dialog`，宽度 900px，内部左右分栏：

**左侧（记录列表区，约 300px）**：
- 搜索框（支持搜索标题和内容）
- 分类筛选下拉（动态获取所有已使用的分类）
- 记录列表（显示标题和分类标签）
- 创建新记录按钮
- 回收站 Tab

**右侧（详情/编辑区）**：
- 标题输入框
- 分类输入框（支持 el-autocomplete 自动补全已有分类）
- 内容描述文本域
- 版本历史按钮
- 保存/删除操作按钮

### 交互流程
1. 点击 Header 按钮打开弹窗
2. 左侧显示当前项目的所有记录，可搜索/筛选
3. 点击左侧记录，右侧显示详情并支持编辑
4. 点击「新建」按钮，右侧变为空白编辑表单
5. 保存时自动创建版本快照
6. 删除后进入回收站，可恢复或永久删除

## 文件变更清单

### 新建文件
| 文件 | 说明 |
|------|------|
| `src/server/routes/miscRecords.ts` | 后端路由 |
| `src/renderer/stores/miscRecordStore.ts` | Pinia Store |
| `src/renderer/components/MiscRecordPanel.vue` | 弹窗组件 |

### 修改文件
| 文件 | 修改内容 |
|------|---------|
| `src/shared/types.ts` | 添加 MiscRecord、MiscRecordVersion、DbMiscRecord、DbMiscRecordVersion 接口 |
| `src/server/db/schema.ts` | 添加 misc_records 和 misc_record_versions 建表 SQL + 索引 |
| `src/server/index.ts` | 注册 miscRecords 路由 |
| `src/server/utils/formatters.ts` | 添加 formatMiscRecord 函数 |
| `src/renderer/utils/api.ts` | 添加 miscRecordApi 对象 |
| `src/renderer/components/MainLayout.vue` | 添加杂物记录按钮和弹窗组件 |

## 实施顺序

1. 添加共享类型定义（shared/types.ts）
2. 添加数据库 Schema（server/db/schema.ts）
3. 创建后端路由（server/routes/miscRecords.ts）
4. 添加格式化器（server/utils/formatters.ts）
5. 注册路由（server/index.ts）
6. 添加前端 API（renderer/utils/api.ts）
7. 创建 Pinia Store（renderer/stores/miscRecordStore.ts）
8. 创建弹窗组件（renderer/components/MiscRecordPanel.vue）
9. 集成到主布局（renderer/components/MainLayout.vue）
