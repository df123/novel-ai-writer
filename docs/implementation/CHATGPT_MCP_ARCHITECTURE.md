# ChatGPT Web Chat MCP 架构说明

> 分支:`feat/chatgpt-mcp-app`
> 目标:在不动原 Web 系统的前提下,为 ChatGPT 普通聊天(Developer Mode + Custom MCP/App)提供一个管理小说结构化数据的 MCP 服务。

## 一、总体结构

```
                         ┌─────────────────────┐
                         │ 原 Novel Web UI     │
                         │ Chat/Voice/LLM      │
                         │ Illustration 等     │
                         └──────────┬──────────┘
                                    │ REST /api/*
                             Domain Services
                                    │
                                    ▼
                                 SQLite (sql.js)
                                    ▲
                             Domain Services
                                    │
                         ┌──────────┴──────────┐
                         │ Novel Writer MCP    │
                         │ POST /mcp           │
                         └──────────┬──────────┘
                              HTTPS (Apache 反代)
                                    ▼
                              ChatGPT Web Chat
```

- **MCP 是新增入口,不是替代**。原 ChatPanel、chatStore、chats/messages、LLM Provider 全套、Prompt Templates、Research Tools、FunASR 语音、AI 插画(ComfyUI)、DatabasePanel 全部保留。
- **MCP 不调用任何 LLM**(llmService 与 MCP 完全无依赖)。小说创作由 ChatGPT 完成,MCP 只管数据。
- chats/messages、语音、插画、Research、DB admin **不暴露为 MCP 工具**。

## 二、分层

```
REST Route (src/server/routes/*)      ← 薄封装,保持原路径与响应形状
       │
Domain Service (src/server/services/domain/)
       │  projectService / themeService / timelineService /
       │  characterService / worldEntryService / chapterService /
       │  storyContextService / storySearchService / storyItemService
       ▼
SQLite (src/server/db, withWriteTransaction)
       ▲
MCP Tool (src/server/mcp/tools/*)     ← 独立的协议层定义,不复用前端 tools.ts
```

- 领域错误统一 `DomainError`(INVALID_ARGUMENT / NOT_FOUND / CONFLICT / ...),REST 层映射 HTTP 状态码,MCP 层映射为可恢复错误文本。
- 写操作统一走 `withWriteTransaction()`:BEGIN → 版本快照 → 实体更新 → COMMIT → saveDB,异常 ROLLBACK,杜绝半完成状态。

## 三、MCP 服务端(src/server/mcp/)

| 文件 | 职责 |
|---|---|
| `server.ts` | `createMcpServer()` 工厂 + `runTool` 统一包装(限流/日志/错误映射) |
| `httpTransport.ts` | Streamable HTTP 无状态传输,每请求独立 transport+server |
| `instructions.ts` | name=novel-ai-writer, version=1.0.0, 短指令 |
| `schemas/entities.ts` | 全部工具的 zod 输入约束(标题≤300、类目≤100、查询≤500、limit 1-100、正文≤2M 字符等) |
| `tools/*.ts` | 9 组工具注册(projects/context/theme/timeline/characters/world/chapters/versions/export) |
| `errors.ts` | DomainError → MCP 错误映射,不泄露 stack |
| `result.ts` | structuredContent + content 双通道返回 |
| `rateLimit.ts` | 读 120/分,写 30/分,搜索 30/分(内存计数) |
| `auth.ts` | 认证(见下) |
| `downloads.ts` | 导出文件单次令牌(10 分钟 TTL) |

### 关键设计决策

1. **无状态、无 currentProject**:不使用 Mcp-Session-Id,任何请求独立处理;除 list/get_project 外全部工具显式传 `project_id`,适配多个 ChatGPT 对话并发调用与反代环境。
2. **乐观并发**:所有 update 工具接受 `expected_updated_at`(Unix 秒),不匹配返回 CONFLICT 并附重读提示。时间戳为秒级,同秒内的先后写入不做区分(与既有库一致)。
3. **版本快照是服务器规则**:MCP 更新版本化实体(character/timeline/world_entry/theme/chapter)自动保存旧状态快照,模型无法关闭。主题沿用 theme_history,其余沿用 `*_versions` 表,章节新增 `chapter_versions` 表(向后兼容迁移,`CREATE TABLE IF NOT EXISTS`)。
4. **Web 与 MCP 同享 chapterService.update()**:原 Web 章节更新同样获得版本保护(schema 迁移对旧库无损)。
5. **软删除**:MCP 只有 archive(对应 deleted=1),永久删除仍只在原 Web 管理界面。
6. **导出**:export_manuscript 只返回元数据 + 单次下载令牌(`/mcp/download/<token>`,10 分钟、单次有效),正文不进 structuredContent,不暴露本地路径。
7. **Character/TimelineNode/MiscRecord 响应新增 `updatedAt` 字段**(纯增量,旧前端不受影响),供 MCP 并发检查读取。

## 四、认证(src/server/mcp/auth.ts)

`MCP_AUTH_MODE` 三种模式:

| 模式 | 说明 | 适用 |
|---|---|---|
| `none` | 直接放行;生产环境启动时打印显著警告 | 本地开发 / MCP Inspector |
| `token` | 校验 `Authorization: Bearer <MCP_STATIC_TOKEN>` | ChatGPT 自定义连接器粘贴令牌 |
| `oauth` | 内置 OAuth 2.1 授权服务器:PKCE(S256)+ 动态客户端注册 + refresh token,暴露 `/.well-known/oauth-protected-resource` 与 `/.well-known/oauth-authorization-server` | 符合 MCP Authorization 规范的正式公网方案 |

oauth 模式相关环境变量:`MCP_PUBLIC_URL`(对外基准 URL)、`MCP_OAUTH_PASSWORD`(授权页口令)。客户端/令牌存内存,服务重启后 ChatGPT 需重新授权(单用户系统可接受)。

## 五、Express 集成

- `/mcp`、`/health`、`/.well-known/*`、`/oauth/*`、`/mcp/download/:token` 由 `src/server/routes/mcp.ts` 提供,**注册在 SPA fallback、404、错误处理之前**,GET /mcp 不会被 index.html 吞掉(无状态下 GET/DELETE 由 SDK 返回 405)。
- `src/server/app.ts` 提供 `createApp()` 工厂(测试复用),`src/server/index.ts` 仅做 initDB + listen。

## 六、数据库变更(全部向后兼容)

- 新增表 `chapter_versions`(id, chapter_id, chapter_number, title, content, version, created_at,CASCADE)+ 索引;存量库启动时自动建表,不重建、不清空。
- `ALLOWED_TABLES` 增加 `chapter_versions`(DatabasePanel 可见)。
- 其余表结构零改动;chats/messages/illustrations 及各版本表原样保留。

## 七、测试

- vitest(需与 vite 5 兼容,锁 `vitest@^2.1.9`),supertest 做 HTTP 层。
- 每个测试文件独立临时数据库(`tests/setup.ts` 将 `DB_DIR` 指向 mkdtemp 目录),**绝不触碰真实 `~/.novel-ai-writer/database.db`**。
- 覆盖:领域服务(CRUD/版本/并发/跨项目隔离)、REST 回归(原路径原状态码)、MCP 协议(initialize/tools/list/tools/call 全链路、错误恢复、导出下载单次有效、危险工具不存在)。
- 命令:`pnpm test` / `pnpm test:server` / `pnpm test:mcp` / `pnpm mcp:inspect`。

## 八、已知边界(如实记录)

- 秒级 updated_at:同一秒内的并发写不做冲突区分。
- 限流为单实例内存计数,重启清零。
- oauth 模式客户端注册与令牌存内存,重启失效。
- ChatGPT Plus Web host 对 write 工具的实际可用性以真机测试为准(见部署文档);服务端 write 能力完整实现且 annotation 如实标注。
