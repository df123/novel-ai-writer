# Novel Writer MCP 工具清单

Endpoint:`POST /mcp`(Streamable HTTP,无状态)
Server:`novel-ai-writer` v1.0.0

约定:

- 除 `list_projects` / `get_project` / `create_project` 外,所有工具必须显式传 `project_id`。
- 所有更新类工具接受可选 `expected_updated_at`(上次读取到的 `updated_at`,Unix 秒);不匹配返回 `[CONFLICT]` 可恢复错误。
- 所有工具返回 `structuredContent`(结构化)+ `content`(一句话摘要),且带与实际输出一致的 `outputSchema`(SDK 逐调用校验)。
- 时间戳均为 Unix 秒。

## Projects

| 工具 | 读/写 | 说明 |
|---|---|---|
| `list_projects` | R | 列出全部项目(id/title/description/updated_at) |
| `get_project` | R | 按 UUID 读取单个项目 |
| `create_project` | W | 新建项目(title, description) |
| `update_project` | W | 更新项目(title/description,支持并发检查) |

> 有意不提供 `delete_project`,防止整本小说被误删。

## Story Context(最核心)

| 工具 | 说明 |
|---|---|
| `get_story_context` | 项目全貌:project、theme、characters、timeline、world_entries(仅摘要)、chapters(仅索引 id/number/title/updated_at,正文不进 context,防 token 失控)。集合超限时 `truncated: true` |
| `search_story` | 关键词跨实体检索(参数化 LIKE,query≤500 字符,types 可选,limit 1-100 默认 20),返回 type/id/title/snippet |
| `get_story_item` | 按 type(theme/character/timeline/world_entry/chapter)+ UUID 读完整实体,校验项目归属 |

## Theme

| 工具 | 说明 |
|---|---|
| `get_theme` | 当前主旨(每项目单例,无则 null) |
| `upsert_theme` | 不存在则创建,存在则先写历史快照再更新(created_by 记为 `llm`,保持既有枚举语义) |

## Timeline

`create_timeline_event` / `update_timeline_event` / `archive_timeline_event`(软删除)。字段:title、date(故事内时间标签)、content、order_index。

## Character

`create_character` / `update_character` / `archive_character`。字段:name、personality、background、relationships。更新前必须先通过 search/context 解析出 character_id,禁止按姓名猜测。

## World Entry(底层 misc_records,对外统一 world_entry)

`create_world_entry` / `update_world_entry` / `archive_world_entry`。字段:title、category(自由字符串:城市/宗门/功法/物品…)、content。

## Chapter

| 工具 | 说明 |
|---|---|
| `list_chapters` | 章节索引(无正文) |
| `get_chapter` | 读完整章节正文 |
| `create_chapter` | 保存新章节;编号冲突返回 CONFLICT。**仅在用户明确同意保存时调用**,讨论稿不得自动入库(2026-09-11 移除了无实际语义的 expected_updated_at 参数) |
| `update_chapter` | 更新章节(自动写 chapter_versions 快照) |
| `archive_chapter` | 软删除(可恢复) |

## Versions / Trash(第二阶段)

| 工具 | 说明 |
|---|---|
| `list_item_versions` | 某实体的版本快照列表 |
| `restore_item_version` | 恢复到指定版本(当前状态会先快照,操作可逆) |
| `list_trash` | 回收站列表(character/timeline/world_entry/chapter) |
| `restore_item` | 从回收站恢复 |

> 不提供永久删除 MCP 工具;永久删除仅在原 Web 管理界面。

## Export

`export_manuscript`(format: md|txt):返回 filename/mime_type/size/chapter_count + `download_token`;正文通过 `GET /mcp/download/<token>` 获取,令牌 10 分钟内单次有效。

## 安全annotation

- 读取类:`readOnlyHint: true`
- 写入/创建/软删除:`readOnlyHint: false, destructiveHint: false`(软删除可恢复)
- 全部 `openWorldHint: false`
- 不存在任何 SQL、永久删除、聊天、语音、插画、研究类工具
