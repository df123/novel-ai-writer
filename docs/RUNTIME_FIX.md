# 运行时错误修复

## 问题：TypeError: Cannot read properties of undefined (reading 'getPath')

### 错误信息
```
TypeError: Cannot read properties of undefined (reading 'getPath')
    at initSqlJs (/home/df/novel-ai/src/main/database/index.ts:7:31)
```

### 原因分析

在 Electron 中，`app` 对象不是在模块加载时立即可用的。在模块顶层执行 `app.getPath()` 会导致 `app` 为 `undefined`。

**错误代码：**
```typescript
import { app } from 'electron';

const DB_PATH = path.join(app.getPath('userData'), 'novel-ai.db'); // ❌ app 是 undefined
```

### 解决方案

将 `app.getPath()` 的调用延迟到实际需要数据库路径的时候，此时 Electron 应用已经初始化完成。

**修复后的代码：**
```typescript
import { app } from 'electron';

function getDBPath(): string {
  const userDataPath = app.getPath('userData'); // ✅ 在调用时才执行
  return path.join(userDataPath, 'novel-ai.db');
}

// 在需要时调用
const DB_PATH = getDBPath();
```

### 修改的文件

**src/main/database/index.ts**

1. **删除**模块顶层的常量定义：
   ```typescript
   - const DB_PATH = path.join(app.getPath('userData'), 'novel-ai.db');
   - const DB_BACKUP_PATH = path.join(app.getPath('userData'), 'novel-ai.db-wal');
   ```

2. **添加** getDBPath() 函数：
   ```typescript
   function getDBPath(): string {
     const userDataPath = app.getPath('userData');
     return path.join(userDataPath, 'novel-ai.db');
   }
   ```

3. **更新** initializeDatabase() 函数：
   ```typescript
   async function initializeDatabase(): Promise<void> {
     // ...
     const DB_PATH = getDBPath(); // 在这里调用
     try {
       const data = await fs.readFile(DB_PATH);
       // ...
     }
   }
   ```

4. **更新** saveDatabase() 函数：
   ```typescript
   export async function saveDatabase(): Promise<void> {
     if (db) {
       const data = db.export();
       const DB_PATH = getDBPath(); // 在这里调用
       await fs.writeFile(DB_PATH, Buffer.from(data));
     }
   }
   ```

5. **更新** closeDatabase() 函数：
   ```typescript
   export async function closeDatabase(): Promise<void> {
     if (db) {
       const data = db.export();
       const DB_PATH = getDBPath(); // 在这里调用
       await fs.writeFile(DB_PATH, Buffer.from(data));
       db.close();
       db = null;
     }
   }
   ```

### 为什么这样修复有效？

在 Electron 的生命周期中：

1. **模块加载阶段**：`app` 对象存在但未完全初始化
2. **app.whenReady()**：`app` 完全初始化
3. **运行时**：`app` 可以安全使用

通过将 `app.getPath()` 调用移到函数内部（`getDBPath()`），我们确保只在函数被调用时才访问 `app`，此时应用已经完全初始化。

### 验证步骤

1. **编译主进程**：
   ```bash
   pnpm exec tsc -p tsconfig.main.json
   ```

2. **运行类型检查**：
   ```bash
   pnpm typecheck
   ```

3. **启动开发模式**：
   ```bash
   pnpm dev
   ```

4. **验证应用启动**：
   - 不应出现 `app.getPath()` 错误
   - 数据库应正确初始化
   - 创建项目功能应正常工作

### 相关知识点

#### Electron app 对象生命周期

```typescript
import { app, BrowserWindow } from 'electron';

// ❌ 错误：模块顶层
const userData = app.getPath('userData');

// ✅ 正确：在回调或函数中
app.whenReady().then(() => {
  const userData = app.getPath('userData'); // 安全
  createWindow();
});

function getDatabasePath() {
  // ✅ 也安全，因为函数在被调用时 app 已初始化
  return app.getPath('userData');
}
```

#### 其他需要注意的 Electron API

以下 Electron API 也需要注意调用时机：

- `app.getPath()` - 需要在 app 初始化后
- `app.getName()` - 需要在 app 初始化后
- `app.getVersion()` - 需要在 app 初始化后
- `process.platform` - 可以在模块顶层使用
- `process.arch` - 可以在模块顶层使用

### 测试清单

- [x] TypeScript 编译通过
- [x] 类型检查通过
- [x] 应用启动不报错
- [x] 数据库正确创建
- [x] 创建项目功能正常
- [x] 文件路径正确获取

### 后续优化建议

1. **错误处理**：为 `getDBPath()` 添加错误处理
2. **路径验证**：确保用户数据目录存在并可写
3. **日志记录**：添加数据库初始化日志

```typescript
function getDBPath(): string {
  try {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'novel-ai.db');
  } catch (error) {
    console.error('Failed to get user data path:', error);
    throw error;
  }
}
```
