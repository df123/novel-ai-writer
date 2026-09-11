# ChatGPT MCP 部署指南(Apache HTTPS 反向代理)

> 生产部署以 **Apache** 为唯一主反向代理方案(Nginx 不在本项目范围内,not covered)。

## 一、部署拓扑

```
Internet
   ↓
Apache :443 (HTTPS)
   ↓
127.0.0.1:3002 (Express)
   ↓
/mcp 及配套端点
```

建议使用独立域名(下文以 `mcp.example.com` 代称,替换为实际域名)。

## 二、服务端启动

```bash
# 生产模式运行(建议配合 systemd 或 nohup)
NODE_ENV=production \
MCP_AUTH_MODE=oauth \
MCP_PUBLIC_URL=https://mcp.example.com \
MCP_OAUTH_PASSWORD='你的授权口令' \
pnpm start
```

环境变量速查:

| 变量 | 说明 |
|---|---|
| `NODE_ENV` | `production` 时启用静态托管与生产警告 |
| `MCP_AUTH_MODE` | `none` / `token` / `oauth`,生产必须非 none |
| `MCP_STATIC_TOKEN` | token 模式的静态 Bearer 令牌 |
| `MCP_PUBLIC_URL` | 对外基准 URL(oauth 元数据、授权页回跳) |
| `MCP_OAUTH_PASSWORD` | oauth 授权页口令 |
| `PORT` / `DB_DIR` | 端口(默认 3002)/ 数据目录(默认 `~/.novel-ai-writer`) |

> `MCP_AUTH_MODE=none` 在 NODE_ENV=production 下启动会打印显著警告:任何能访问端口的人都可读写全部小说数据。不得把裸 `/mcp` 长期暴露公网。

## 三、Apache 配置

启用模块:

```bash
a2enmod proxy proxy_http headers ssl
```

站点配置(`/etc/apache2/sites-available/novel-mcp.conf`,证书路径与域名按实际调整):

```apache
<VirtualHost *:443>
    ServerName mcp.example.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/mcp.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/mcp.example.com/privkey.pem

    ProxyRequests Off
    ProxyPreserveHost On

    RequestHeader set X-Forwarded-Proto "https"

    # MCP JSON-RPC 与流式响应,长超时
    ProxyTimeout 600
    ProxyPass        /mcp http://127.0.0.1:3002/mcp timeout=600 retry=0
    ProxyPassReverse /mcp http://127.0.0.1:3002/mcp

    # 导出下载(单次令牌)
    ProxyPass        /mcp/download http://127.0.0.1:3002/mcp/download timeout=60 retry=0
    ProxyPassReverse /mcp/download http://127.0.0.1:3002/mcp/download

    # 健康检查
    ProxyPass        /health http://127.0.0.1:3002/health timeout=10 retry=0
    ProxyPassReverse /health http://127.0.0.1:3002/health

    # OAuth(公网使用 oauth 模式时必需)
    ProxyPass        /oauth http://127.0.0.1:3002/oauth timeout=30 retry=0
    ProxyPassReverse /oauth http://127.0.0.1:3002/oauth

    ProxyPass        /.well-known/oauth-protected-resource http://127.0.0.1:3002/.well-known/oauth-protected-resource timeout=10 retry=0
    ProxyPassReverse /.well-known/oauth-protected-resource http://127.0.0.1:3002/.well-known/oauth-protected-resource

    ProxyPass        /.well-known/oauth-authorization-server http://127.0.0.1:3002/.well-known/oauth-authorization-server timeout=10 retry=0
    ProxyPassReverse /.well-known/oauth-authorization-server http://127.0.0.1:3002/.well-known/oauth-authorization-server

    ErrorLog ${APACHE_LOG_DIR}/novel-mcp-error.log
    CustomLog ${APACHE_LOG_DIR}/novel-mcp-access.log combined
</VirtualHost>
```

生效:

```bash
apachectl configtest
systemctl reload apache2
```

**重要**:该专用域名只代理 MCP 必要路径(`/mcp`、`/mcp/download`、`/health`、`/oauth`、`/.well-known/*`)。**不要**把 `/api/db`、`/api/settings`、`/api/llm` 等管理面接口开放到公网域名;原 Web UI 继续留在内网访问。

Apache 注意事项(Streamable HTTP):

- 不得把 `/mcp` 重定向成 HTML、不得缓存响应、不得改写 JSON body、不得强制 gzip 打断流式输出、不得提前截断长连接(以上配置已用 `timeout=600` 规避)。
- MCP transport 是 HTTP,不需要 WebSocket。

## 四、本地验证(MCP Inspector)

```bash
pnpm mcp:inspect
# 或 npx @modelcontextprotocol/inspector@latest
```

- Transport: Streamable HTTP
- URL: `http://127.0.0.1:3002/mcp`(本地默认 MCP_AUTH_MODE=none)
- 依次验证 initialize → tools/list → 各 read/write 工具

公网验证:Inspector 指向 `https://mcp.example.com/mcp`,认证方式选 OAuth(会走完整授权码流程)或 Bearer Token。

curl 快速冒烟:

```bash
curl -s -X POST https://mcp.example.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer <token>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 五、ChatGPT Web Chat 接入

目标环境:**chatgpt.com 普通聊天 + Developer Mode + 自定义 MCP/App**。不使用、也不依赖 ChatGPT Work / Workspace Agent / Codex 等环境。

步骤:

1. 打开 ChatGPT 设置 → 连接器/开发者 → 添加自定义 MCP 服务器。
2. Streamable HTTP URL 填 `https://mcp.example.com/mcp`。
3. 认证:
   - `token` 模式:粘贴 `MCP_STATIC_TOKEN`;
   - `oauth` 模式:ChatGPT 自动发现授权服务器,弹出授权页后输入 `MCP_OAUTH_PASSWORD` 批准。
4. 保存后 **Refresh / Scan Tools**,确认 28 个工具出现。

验收测试集(在普通聊天窗口逐条进行):

| 用户输入 | 预期工具调用 |
|---|---|
| "列出我的小说项目" | `list_projects` |
| "继续写《XXX》,先看看现在的设定" | `list_projects` → `get_story_context` |
| "林浩现在是什么性格?" | `search_story` / `get_story_item` |
| "把林浩改得更谨慎" | 读 → `update_character`(自动快照) |
| "之前是不是有个叫黑岩城的城市?" | `search_story` |
| "把第12章给我看看" | `list_chapters` / `get_chapter` |
| "刚才这版不错,保存成第13章" | `create_chapter` |
| "给我解释什么是第一人称写作" | 不调用 MCP |
| "给这一章生成一张图片" | 不调用插画(不存在的工具) |

注意:

- 修改工具 schema 后必须重新 Refresh/Scan Tools,ChatGPT 不会自动感知。
- 若当前 ChatGPT Plus Web host 限制 write 类工具:服务端 write 能力完整且 annotation 如实标注(不伪装 readOnly),read 工作流应独立可用;在测试记录中如实标注 "Server capability: supported / ChatGPT Plus Web host availability: currently restricted"。

## 六、安全清单

- [ ] 公网 `/mcp` 已启用认证(token 或 oauth),不是 none
- [ ] MCP 域名未暴露 `/api/db`、`/api/settings`、`/api/llm`
- [ ] TLS 证书有效,HTTP→HTTPS 跳转已配置(建议)
- [ ] `MCP_OAUTH_PASSWORD` 为强口令
- [ ] 服务器日志只含元数据(工具名/项目ID/时长),无正文无令牌
- [ ] 数据库有定期备份(参考 `~/.novel-ai-writer/backups/`)
