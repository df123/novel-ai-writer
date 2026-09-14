# ChatGPT Web Chat 真机验收报告(MCP V1)

> 状态:**ChatGPT Web 真机测试已完成(2026-09-11)**;公网 HTTPS Inspector 独立验收与真实部署进程重启烟雾测试两项为 **Pending**,见文末。
> 本报告为真实执行记录,未包含截图归档、未执行的 Inspector 结果或 Docker restart 结果——这些项目均如实标注 Pending,未伪造。

## 基本信息

| 项 | 值 |
|---|---|
| 日期 | 2026-09-11 |
| ChatGPT 套餐 | Plus |
| 环境 | 普通 Web Chat(非 ChatGPT Work) |
| Developer Mode | 是 |
| 连接方式 | 自定义 `@novel-ai` MCP 连接器(OAuth) |
| 工具扫描结果 | 28 Tools 全部被 Host 发现 |
| 测试项目 | `MCP验收临时项目`(为本验收专门创建) |
| 数据安全 | 未修改任何真实小说项目;未执行任何永久删除(仅 archive 软删除 + restore 恢复验证) |

## 原定能力验收(任务书 §5 / 原任务书 §54)— PASS(部分场景使用隔离测试项目的等效数据)

> 测试开始时部署库中**无任何已有真实项目**(list_projects 返回 0 个),原始记录中"真实项目只读 Context"一项为 **N/A**。因此全部读写均在专门新建的隔离项目内完成;涉及具体实体名称/章节号的场景(5.3–5.7)使用等效数据(验收角色、验收城市、第 1 章等),而非 prompt 字面上的"林浩 / 黑岩城 / 第12章 / 第13章"。下表 **Equivalent PASS** 即表示:精确 prompt 场景未按字面执行,对应工具能力已在隔离项目以等效数据真机验证。

| # | Prompt | 预期工具序列 | 结果 | 备注 |
|---|---|---|---|---|
| 5.1 | 列出我的小说项目。 | list_projects | **PASS** | 按字面执行;当时返回 0 个已有项目(部署库为空),该结果直接触发了隔离验收项目的新建 |
| 5.2 | 继续写《XXX》,先看看现在的设定。 | list_projects → get_story_context | **Equivalent PASS** | 测试开始时无已有真实项目,未执行"按已有项目标题解析"的精确场景;create_project(新建 `MCP验收临时项目`)与 get_story_context 已在隔离测试项目实际验证 |
| 5.3 | 林浩现在是什么性格? | search_story / get_story_item | **Equivalent PASS** | 对隔离项目的验收角色执行(非字面"林浩");含 create_character + get_story_item |
| 5.4 | 把林浩改得更谨慎。 | get_story_item → update_character | **PASS**(等效场景:对验收角色执行) | write 放行;携带 expected_updated_at;自动产生旧版本快照 |
| 5.5 | 之前是不是有个叫黑岩城的城市? | search_story | **Equivalent PASS** | 对隔离项目的验收城市执行(非字面"黑岩城");含 create_world_entry 前置数据构造 |
| 5.6 | 把第12章给我看看。 | list_chapters / get_chapter | **Equivalent PASS** | 验证于隔离项目实际章节(第 1 章),非字面第 12 章 |
| 5.7 | (先生成正文)…刚才这版不错,保存成第13章。 | create_chapter | **Equivalent PASS** | 保存为隔离项目的验收章节;草稿讨论阶段未自动写库(见扩展验证) |
| 5.8 | 给我解释什么是第一人称写作。 | 不调用任何 MCP 工具 | **PASS** | 普通知识问题未调用 novel MCP |
| 5.9 | 给这一章生成一张图片。 | 不出现小说侧生图工具 | **PASS** | 未伪造/误调用小说 MCP 插画工具;图片由 ChatGPT 原生能力处理 |
| 5.10 | (多结果搜索后)第一个详细说说。 | get_story_item(用上一步返回的稳定 ID) | **PASS** | stable-ID follow-up 于隔离项目搜索结果验证通过 |

## 扩展验证集(真机追加)

| 验证项 | 结果 |
|---|---|
| create_project | **PASS** |
| get_story_context 不包含 Chapter 正文 | **PASS** |
| create_character | **PASS** |
| get_story_item | **PASS** |
| update_character + expected_updated_at | **PASS** |
| Character version snapshot(更新自动生成旧版本快照) | **PASS** |
| create_timeline_event | **PASS** |
| update_timeline_event | **PASS** |
| Timeline version snapshot | **PASS** |
| create_world_entry | **PASS** |
| search_story | **PASS** |
| stable ID follow-up | **PASS** |
| 草稿阶段无 MCP save(用户未明确"保存"时不写库) | **PASS** |
| create_chapter | **PASS** |
| list_chapters / get_chapter | **PASS** |
| update_chapter | **PASS** |
| Chapter version snapshot | **PASS** |
| archive_character | **PASS** |
| list_trash | **PASS** |
| restore_item | **PASS** |
| 普通知识问题不调用 novel MCP | **PASS** |
| 图片请求不伪造小说 MCP 插画工具 | **PASS** |
| 新闻请求不调用 novel MCP | **PASS** |
| stale expected_updated_at → CONFLICT | **PASS** |
| CONFLICT 不生成错误版本快照 | **PASS** |

## write 能力结论(实测)

```text
Server capability: supported
ChatGPT Plus Web host availability: allowed
```

write 工具在 ChatGPT Plus 普通 Web Chat 中真实放行并成功写入(含版本快照);未伪造任何 readOnlyHint。

## 总结论(Host 侧已实测)

```text
Read tools: PASS
Write tools: PASS
Versioning: PASS
Archive/Restore: PASS
Follow-up entity resolution: PASS
Tool selection quality: PASS
CONFLICT / optimistic concurrency: PASS
Overall: PASS
```

## 额外观察

- 错误工具选择:未出现(知识/图片/新闻三类越界请求均未误调用 novel MCP)。
- 意外确认弹窗:write 放行(allowed),未观察到宿主拦截行为。
- refresh/续期(次日用一次):**Pending** — 未执行。
- 服务重启后免重新授权:**Pending** — 见下节部署烟雾测试。

## 公网 HTTPS MCP Inspector 验收(任务书 §6)

```text
Public HTTPS MCP Inspector: PENDING — requires deployment-host/user-side validation
```

| 项 | 结果 |
|---|---|
| Inspector(Streamable HTTP)→ https://<域名>/mcp OAuth 连接 | Pending |
| OAuth discovery(well-known) | Pending |
| initialize | Pending |
| tools/list(28 个) | Pending |
| 一个 read 工具(list_projects) | Pending |
| 一个 write 工具(于 `MCP验收临时项目` 内) | Pending |
| token refresh(如 Inspector 支持) | Pending |

### 用户执行步骤

1. 本地启动 Inspector(绕过本机代理):
   ```bash
   env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy pnpm mcp:inspect
   ```
2. URL 填 `https://<你的MCP域名>/mcp`,认证方式选 OAuth,浏览器完成授权(输入 MCP_OAUTH_PASSWORD)。
3. 依次执行 initialize、tools/list(确认 28 个)、list_projects、在 `MCP验收临时项目` 内做一次安全 write(如 update 某 testing character)。
4. 如 Inspector 支持手动 token refresh,验证 refresh token 轮换。
5. 把结果回填本表(通过/失败),完成后本项即不再是 Pending。

## 真实部署进程重启 OAuth 烟雾测试(第四轮任务书 §四)

```text
OAuth persistence after real process restart: PENDING — user deployment smoke test required
```

代码级持久化已由自动测试证明(真实 `initDB()` 磁盘重载测试,见 `tests/mcp/oauth.test.ts`),此项仅为部署层最终确认,不代表代码缺陷。

### 用户执行步骤

1. 确认 ChatGPT 已连接 `@novel-ai`(现有连接器,不删除、不重连)。
2. 在部署服务器执行:
   ```bash
   cd /opt/novel-ai-writer && docker compose restart
   ```
3. 回到 ChatGPT(不重新授权),直接发送"列出我的小说项目"触发 list_projects。
4. 若无需重新 OAuth 即返回项目列表 → 本项记 PASS;若被要求重新授权 → 记 FAIL 并回传服务器日志排查。
