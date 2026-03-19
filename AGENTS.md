# AGENTS.md

## 开发命令

### 核心命令
- `pnpm install` - 使用 pnpm 安装依赖
- `pnpm dev` - 启动开发模式（服务器端口 3002，渲染器端口 3004）
- `pnpm dev:server` - 仅启动 Express 服务器
- `pnpm dev:renderer` - 仅启动 Vite 开发服务器
- `pnpm build` - 构建生产版本
- `pnpm preview` - 本地预览构建后的渲染器

### 代码质量
- `pnpm typecheck` - 运行 TypeScript 类型检查（noEmit）
- `pnpm lint` - 在 src/ 目录运行 ESLint（.ts, .vue 文件）

### 测试
当前未配置测试框架。添加测试时，请先查看 README 或询问合适的测试命令。

## 代码风格指南

### 导入顺序
导入语句应遵循以下顺序：
1. Vue 和框架导入
2. 第三方库（Element Plus 组件等）
3. 第三方图标（@element-plus/icons-vue）
4. 本地导入（stores, components, utils）
5. 共享导入（@shared/*）

示例：
```typescript
import { ref, computed, onMounted } from 'vue';
import { ElButton, ElInput, ElMessage } from 'element-plus';
import { HomeFilled } from '@element-plus/icons-vue';
import { useChatStore } from '../store/chatStore';
import { formatTimestamp } from '../../shared/utils';
```

### 命名规范
- **文件**: camelCase（例如：`chatStore.ts`，组件使用 PascalCase 如 `ChatPanel.vue`）
- **组件**: PascalCase，使用 `<script setup>` 语法（例如：`<script setup lang="ts">`）
- **函数/变量**: camelCase（例如：`loadMessages`, `isLoading`）
- **接口/类型**: PascalCase（例如：`Message`, `ChatState`）
- **常量**: 模块级常量使用 UPPER_SNAKE_CASE
- **Store**: Pinia stores 命名为 `use*Store`（例如：`useChatStore`, `useProjectStore`）

### 代码注释
- **注释语言**: 所有注释必须使用中文
- **注释原则**: 非必要不添加注释，代码本身应足够清晰
- **注释维护**: 当注释与代码逻辑不符合时，必须修改注释使其符合代码逻辑
- **注释时机**: 仅在代码逻辑复杂、业务逻辑特殊或需要特别说明的情况下添加注释

### TypeScript
- 对象形状使用 `interface`，联合类型/别名使用 `type`
- 可选属性用 `?` 标记（例如：`description?: string`）
- 函数参数和返回类型使用正确的类型注解
- 从 `@shared/types` 导入共享类型
- 仅在必要时使用 `any`，未类型化数据优先使用 `unknown`

### Vue 组件
- 使用 `<script setup>` 语法和 Composition API
- 使用 `ref`、`computed`、`onMounted` 等 Vue 3 组合式 API
- Props 使用 `defineProps<T>()` 定义
- Emits 使用 `defineEmits<T>()` 定义
- 使用 `ref<T>()` 和 `reactive<T>()` 定义响应式数据

### 状态管理（Pinia）
- 在 store 文件顶部定义状态接口
- Store hooks 命名为 `use*Store`（例如：`useChatStore`, `useProjectStore`）
- API 调用使用带 try-catch 块的异步 actions
- 使用 `get()` 在 actions 内访问状态，`set()` 更新状态
- 在异步 actions 中使用 `useOtherStore.getState()` 访问其他 stores

### API 层
- 在 `src/renderer/utils/api.ts` 创建专用 API 对象（例如：`projectApi`, `chatApi`）
- REST API 调用使用 axios，流式传输（LLM chat）使用 fetch
- API 函数应返回 axios Response 对象或 fetch Response 对象
- 端点遵循 REST 约定：`list()`, `get(id)`, `create(data)`, `update(id, data)`, `delete(id)`

### 错误处理
- 异步函数使用 try-catch 块
- 使用 `console.error('Context:', error)` 记录错误
- 关键失败抛出错误（例如：缺少项目）
- 适当设置加载状态（之前 `isLoading: true`，之后/错误 `false`）

### 样式（Element Plus）
- 使用 `class` 和 `style` 进行组件样式设置
- Element Plus 组件支持多种样式配置方式
- 优先使用 CSS 类名进行样式管理
- 必要时使用内联样式进行动态样式设置

### 服务器代码（src/server/index.js）
- 服务器当前使用 JavaScript（非 TypeScript）
- 使用 Express.js 进行 API 路由
- 数据库操作使用 sql.js 和自定义 `query()`、`run()` 辅助函数
- 格式化数据库响应以匹配前端命名（例如：`name` → `title`, `created_at` → `createdAt`）
- 主键使用 `generateId()` 生成 UUID
- 时间戳使用 `now()`（Unix 秒级时间戳）

### 路径别名
- `@/*` → `src/*`（在 vite.config.ts 中配置）
- `@shared/*` → `src/shared/*`（在 tsconfig.base.json 中配置）

### 文件结构
- `src/shared/` - 共享工具、类型、常量
- `src/renderer/` - Vue 前端
  - `components/` - Vue 组件
  - `stores/` - Pinia stores
  - `utils/` - 前端工具和 API 层
- `src/server/` - Express 服务器（JavaScript）

### 其他说明
- 项目使用 pnpm 作为包管理器（优于 npm/yarn）
- 服务器运行在端口 3002，渲染器运行在端口 3004
- 数据库存储在 `~/.novel-ai-writer/database.db`
- API 密钥使用 AES-256-CBC 加密，配合机器特定密钥

**系统使用场景：**
- ✅ 本系统仅在内网环境供单一用户使用
- ✅ 部分安全检查（如严格的输入验证、CSRF 防护等）可适当简化
- ✅ 代码审查时可考虑这一使用场景，避免过度安全检查

**根目录管理规范：**
- ✅ 根目录仅保留：`AGENTS.md`（开发指南）、`README.md`（项目说明）
- ✅ 其他文档统一存放：`docs/` 文件夹
  - `docs/implementation/` - 实现文档（IMPLEMENTATION_SUMMARY.md、WEB_IMPLEMENTATION.md等）
  - `docs/guides/` - 功能指南（DATABASE_USAGE.md、DATA_SOURCE_UPDATE.md等）
- ✅ 保持根目录简洁：避免创建临时文件、测试输出文件直接存放在根目录

**日志文件管理规范：**
- ✅ 日志文件统一存放：`logs/` 文件夹
  - `logs/api.log` - 后端API服务日志
  - `logs/web.log` - 前端开发服务日志
- ✅ 启动脚本应配置日志输出到 `logs/` 目录
- ✅ 避免在根目录创建 `.log` 文件

**脚本文件管理规范：**
- ✅ Shell脚本统一存放：`scripts/` 文件夹
  - `scripts/install.sh` - 环境依赖安装脚本
  - `scripts/start_api.sh` - 后端API服务启动脚本
  - `scripts/start_web.sh` - Web服务启动指南脚本
- ✅ 所有 `.sh` 文件应添加可执行权限：`chmod +x scripts/*.sh`
- ✅ 启动服务时从scripts目录执行：`./scripts/start_api.sh`

**数据库文件管理规范：**
- ✅ 数据库文件统一存放：`db/` 文件夹
  - `db/etf_data.db` - SQLite数据库文件
- ✅ 数据库路径配置在 `config.py` 中：`DB_PATH`
- ✅ 使用 `.gitkeep` 保持目录结构追踪
- ✅ 所有 `.db` 文件已在 `.gitignore` 中忽略，不提交实际数据库文件
