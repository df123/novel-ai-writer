# ChatGPT Web Chat 真机验收报告

> 状态模板:待用户在 chatgpt.com 普通 Web Chat(Developer Mode + 自定义连接器)逐项执行后填写。
> 每项记录实际触发的工具序列与结果;截图可另存。
> 环境基准:ChatGPT Plus / 普通 Web Chat / Developer Mode / 连接器 OAuth 已连接。

## 基本信息

| 项 | 值 |
|---|---|
| 日期 | 待填 |
| ChatGPT 套餐 | Plus |
| 环境 | 普通 Web Chat(非 Work) |
| Developer Mode | 是 |
| 连接方式 | Custom MCP Connector(OAuth) |
| 工具扫描结果 | 待填(应为 28 个) |

## 测试集(任务书 §5 / 原任务书 §54)

| # | Prompt | 预期工具序列 | 实际序列 | 结果 | 备注 |
|---|---|---|---|---|---|
| 5.1 | 列出我的小说项目。 | list_projects | | ☐ 通过 ☐ 失败 | |
| 5.2 | 继续写《XXX》,先看看现在的设定。 | list_projects → get_story_context | | ☐ 通过 ☐ 失败 | |
| 5.3 | 林浩现在是什么性格? | search_story / get_story_item | | ☐ 通过 ☐ 失败 | |
| 5.4 | 把林浩改得更谨慎。 | get_story_item → update_character | | ☐ 通过 ☐ 失败 | 记录:write 是否放行、是否产生旧版本快照、有无额外确认弹窗 |
| 5.5 | 之前是不是有个叫黑岩城的城市? | search_story | | ☐ 通过 ☐ 失败 | |
| 5.6 | 把第12章给我看看。 | list_chapters / get_chapter | | ☐ 通过 ☐ 失败 | |
| 5.7 | (先生成正文)…刚才这版不错,保存成第13章。 | create_chapter | | ☐ 通过 ☐ 失败 | 关键:未说"保存"前不得自动写库 |
| 5.8 | 给我解释什么是第一人称写作。 | 不调用任何 MCP 工具 | | ☐ 通过 ☐ 失败 | |
| 5.9 | 给这一章生成一张图片。 | 不出现小说侧生图工具 | | ☐ 通过 ☐ 失败 | ChatGPT 原生图片能力可接受 |
| 5.10 | (多结果搜索后)第一个详细说说。 | get_story_item(用上一步返回的稳定 ID) | | ☐ 通过 ☐ 失败 | |

## write 能力结论(必填)

```
Server capability: supported
ChatGPT Plus Web host availability: (allowed / currently restricted — 实测填一)
```

说明:若 write 工具被宿主拦截,如实记录,不得伪造 readOnlyHint;read 工作流应独立可用。

## 额外观察

- 是否出现错误工具选择:
- 是否出现意外确认弹窗:
- refresh/续期是否正常(次日用一次):
- 服务重启后重新授权体验:

## 公网 HTTPS MCP Inspector 验收(任务书 §6)

| 项 | 结果 |
|---|---|
| Inspector(Streamable HTTP)→ https://<域名>/mcp OAuth 连接 | ☐ 通过 ☐ 失败 |
| initialize | ☐ 通过 ☐ 失败 |
| tools/list(28 个) | ☐ 通过 ☐ 失败 |
| 一个 read 工具(list_projects) | ☐ 通过 ☐ 失败 |
| 一个 write 工具(create_character 于临时项目) | ☐ 通过 ☐ 失败 |
| OAuth discovery(well-known) | ☐ 通过 ☐ 失败 |
| token refresh(如 Inspector 支持) | ☐ 通过 ☐ 失败 / 不支持 |

操作提示:本地 `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy pnpm mcp:inspect`,URL 填公网地址,认证方式选 OAuth。
