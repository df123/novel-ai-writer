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

## 二、裸机部署(无 Docker)

本项目是纯 Node.js 应用,无需 Docker。以 Ubuntu/Debian + Apache 为例:

### 1. 安装 Node.js 与 pnpm

```bash
# Node.js 22(NodeSource 系统级安装,避免 nvm 与 systemd 的路径问题)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
sudo npm install -g pnpm
```

### 2. 获取代码并构建

```bash
sudo mkdir -p /opt/novel-ai-writer && sudo chown "$USER" /opt/novel-ai-writer
cd /opt/novel-ai-writer
git clone -b feat/chatgpt-mcp-app https://github.com/df123/novel-ai-writer.git .
pnpm install
pnpm build        # 产出 dist/renderer + dist/server
```

### 3. 环境变量文件

项目不读取 .env,环境变量由 systemd 注入。创建 `/etc/novel-ai-writer.env`:

```bash
NODE_ENV=production
# 只监听回环地址,必须经 Apache 反代访问(/api/* 管理接口没有自身认证,绝不能直接暴露公网)
HOST=127.0.0.1
PORT=3002

# 认证(生产必须非 none)
MCP_AUTH_MODE=oauth
MCP_PUBLIC_URL=https://mcp.example.com
MCP_OAUTH_PASSWORD=强口令

# API 密钥加密密钥(生成一次,永久不变;迁移旧库时必须用原机器相同的值)
# openssl rand -hex 16
ENCRYPTION_KEY=

# 可选:数据目录(默认 ~/.novel-ai-writer)
# DB_DIR=/var/lib/novel-ai-writer
```

### 4. systemd 服务

创建 `/etc/systemd/system/novel-ai-writer.service`(User 改为实际运行用户,需对数据目录有写权限):

```ini
[Unit]
Description=Novel AI Writer (Express + MCP)
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/opt/novel-ai-writer
EnvironmentFile=/etc/novel-ai-writer.env
ExecStart=/usr/bin/node --import tsx src/server/index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

> 说明:`node --import tsx` 直接以 tsx 运行 TypeScript 入口,无需全局安装;若 `node` 路径不同请用 `which node` 确认。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now novel-ai-writer
# 验证(只绑 127.0.0.1,须在本机执行)
curl -s http://127.0.0.1:3002/health
```

### 5. 防火墙(纵深防御)

```bash
sudo ufw allow 443/tcp
sudo ufw deny 3002/tcp   # 保险:即使 HOST 配错也不暴露
sudo ufw enable
```

### 6. 数据迁移(可选)

服务器默认全新空库。若要把本机小说数据迁过去:

```bash
# 本机执行:先备份再传输
cp ~/.novel-ai-writer/database.db ~/.novel-ai-writer/backups/database.manual.$(date +%Y%m%d).db
scp ~/.novel-ai-writer/database.db USER@server:/home/USER/.novel-ai-writer/database.db
```

注意:库里的 LLM API 密钥用 `ENCRYPTION_KEY` 加密——迁移旧库时,服务器必须配置与原机器相同的 `ENCRYPTION_KEY`(原机器是 Docker 部署则取其 .env;若原机器未设置则用的是机器指纹,只能在新服务器上重新录入 API 密钥)。AI 插画图片目录 `illustrations/` 存的是本机绝对路径,迁移后历史插画路径失效,不影响 MCP。

## 三、服务端启动(手动/临时运行)

```bash
# 临时前台运行(调试用;正式运行用上面的 systemd)
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
| `HOST` | 监听地址,公网部署必须 `127.0.0.1` |
| `MCP_AUTH_MODE` | `none` / `token` / `oauth`,生产必须非 none |
| `MCP_STATIC_TOKEN` | token 模式的静态 Bearer 令牌 |
| `MCP_PUBLIC_URL` | 对外基准 URL(oauth 元数据、授权页回跳) |
| `MCP_OAUTH_PASSWORD` | oauth 授权页口令 |
| `ENCRYPTION_KEY` | API 密钥加密密钥(设置后勿更改) |
| `PORT` / `DB_DIR` | 端口(默认 3002)/ 数据目录(默认 `~/.novel-ai-writer`) |

> `MCP_AUTH_MODE=none` 在 NODE_ENV=production 下启动会打印显著警告:任何能访问端口的人都可读写全部小说数据。不得把裸 `/mcp` 长期暴露公网。

## 四、Apache 配置

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

生效(证书路径与域名按实际调整):

```bash
apachectl configtest
systemctl reload apache2
```

**重要**:该专用域名只代理 MCP 必要路径(`/mcp`、`/mcp/download`、`/health`、`/oauth`、`/.well-known/*`)。**不要**把 `/api/db`、`/api/settings`、`/api/llm` 等管理面接口开放到公网域名;原 Web UI 继续留在内网访问。

> 2026-09-14 起支持将 Web UI 经 `APP_MODE=public` 安全暴露到公网(Web 登录+CSRF+密钥脱敏+限流),MCP 与 Web 各用独立域名/独立认证。
> 详见 `docs/guides/PUBLIC_WEB_DEPLOYMENT.md`。本文件的 MCP 域名配置不变。

Apache 注意事项(Streamable HTTP):

- 不得把 `/mcp` 重定向成 HTML、不得缓存响应、不得改写 JSON body、不得强制 gzip 打断流式输出、不得提前截断长连接(以上配置已用 `timeout=600` 规避)。
- MCP transport 是 HTTP,不需要 WebSocket。

## 五、本地验证(MCP Inspector)

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

## 六、ChatGPT Web Chat 接入

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

## 七、安全清单

- [ ] 公网 `/mcp` 已启用认证(token 或 oauth),不是 none
- [ ] MCP 域名未暴露 `/api/db`、`/api/settings`、`/api/llm`
- [ ] TLS 证书有效,HTTP→HTTPS 跳转已配置(建议)
- [ ] `MCP_OAUTH_PASSWORD` 为强口令
- [ ] 服务器日志只含元数据(工具名/项目ID/时长),无正文无令牌
- [ ] 数据库有定期备份(参考 `~/.novel-ai-writer/backups/`)
