# Public Web V1 部署指南(网页编辑界面公网暴露)

> 实现依据:《Novel Writer Public Web V1 架构与安全设计书》(2026-09-14,基线 master@e965a99)。
> 代码分支:`feat/public-web-v1`。
> **MCP 兼容性说明**:MCP 工具/接口契约(28 工具、schema、OAuth 2.1 授权码/刷新轮换、Domain Services、乐观并发)完全未动;MCP HTTP/OAuth **外围**有有限硬化(端点限流、注册体限制、`/mcp` body 解析独立但上限保持 50MB)。Web 登录与 MCP OAuth 相互独立。

## 1. 运行模式

| | `APP_MODE=local`(默认) | `APP_MODE=public` |
|---|---|---|
| Web 认证 | 无(现状) | 用户名+scrypt 密码+服务端会话 |
| CSRF/Origin | 不启用 | 强制(仅 `/api/*`) |
| CORS | 保持全开(开发便利) | 关闭(同源 SPA) |
| `/api/db` | 注册(数据库管理台可用) | **整个不注册**(404) |
| Provider 密钥 | GET 回显明文(现状) | **write-only**(GET 只返回 `*_configured`) |
| 内部服务地址 | 设置页可改 | 环境变量固定,浏览器不可控 |
| 请求体上限 | JSON 50MB | 登录 8KB / API JSON 4MB / OAuth 注册 16KB；**`/mcp` 保持原 50MB 不变**(路径级独立解析,public 收紧不影响 MCP) |
| 限流 | 无 | 登录 5 失败/15分/IP;普通 API 300/5分;LLM 20/5分;Research 30/5分;Speech 10/5分;插画 5/10分;导出 10/10分 |
| 监听 | 0.0.0.0(现状) | 默认 127.0.0.1;显式 `HOST=0.0.0.0` **拒绝启动** |
| MCP 认证 | 允许 none(警告) | **none 为致命启动错误** |

切换到 public 模式的启动检查(fail-fast,任一不满足进程直接退出):
`NODE_ENV=production`、`WEB_PUBLIC_URL=https://...`、`WEB_USERNAME`、`WEB_PASSWORD_HASH`(scrypt 格式)、
`ENCRYPTION_KEY`(不允许机器指纹回退)、`MCP_AUTH_MODE ∈ {token, oauth}`(oauth 需 `MCP_OAUTH_PASSWORD`,token 需 `MCP_STATIC_TOKEN`)、`MCP_PUBLIC_URL=https://...`、`HOST ≠ 0.0.0.0`。

## 2. 网络拓扑(设计书 §10)

```
                 Internet
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  writer.example.com        mcp.example.com
   Apache Web vhost          Apache MCP vhost(现有,不变)
   SPA + 登录后 API           白名单:/mcp /oauth /.well-known /mcp/download /health
        │                         │
        └───────────┬─────────────┘
                    ▼
             127.0.0.1:3002 Express(单进程,sql.js)
                    │
   ┌────────────────┼────────────────┐
   ▼                ▼                ▼
127.0.0.1:3010   127.0.0.1:3011   127.0.0.1:8317
  FunASR           ComfyUI         CLI Proxy
```

公网只开放 80/443(80 仅跳转 HTTPS)。3002/3010/3011/8317 必须从外部不可达。

**单进程约束(设计书 §40)**:sql.js 内存库只能运行一个 server 进程,禁止 PM2 cluster/多副本/多 worker。

## 3. 裸机部署步骤(推荐,设计书 §43)

### 3.1 生成登录密码哈希

```bash
node scripts/hash-password.mjs '你的强密码'
# 输出: scrypt:16384:8:1:...:...
```

### 3.2 环境变量(/opt/novel-ai-writer/.env)

```bash
APP_MODE=public
NODE_ENV=production
HOST=127.0.0.1
PORT=3002

WEB_PUBLIC_URL=https://writer.example.com
WEB_USERNAME=<owner>
WEB_PASSWORD_HASH=<上一步输出>
WEB_SESSION_TTL_HOURS=168

ENCRYPTION_KEY=<现有稳定密钥,openssl rand -hex 16>

MCP_AUTH_MODE=oauth            # 或 token
MCP_PUBLIC_URL=https://mcp.example.com
MCP_OAUTH_PASSWORD=<强口令>

FUNASR_BASE_URL=http://127.0.0.1:3010
COMFYUI_BASE_URL=http://127.0.0.1:3011
CLIPROXY_BASE_URL=http://127.0.0.1:8317/v1

NO_PROXY=127.0.0.1,localhost
```

### 3.3 systemd 单元

进程持有 API 密钥/OAuth 令牌/会话,**绝不用 root 运行**;密钥文件放 /etc 并收紧权限,不与应用代码同目录。

```bash
# 专用系统用户
useradd --system --home /opt/novel-ai-writer --shell /usr/sbin/nologin novelwriter
chown -R novelwriter:novelwriter /opt/novel-ai-writer
chmod 600 /etc/novel-ai-writer.env && chown root:novelwriter /etc/novel-ai-writer.env
```

```ini
# /etc/systemd/system/novel-ai-writer.service
[Unit]
Description=Novel AI Writer (Express, sql.js single process)
After=network.target

[Service]
User=novelwriter
Group=novelwriter
UMask=0077
WorkingDirectory=/opt/novel-ai-writer
ExecStart=/usr/bin/node dist/server/index.js
EnvironmentFile=/etc/novel-ai-writer.env
Restart=on-failure
# 日志走 journald;应用日志已脱敏(不记录 query string,/mcp/download 令牌打码)

[Install]
WantedBy=multi-user.target
```

对应地,3.2 节的环境变量写入 `/etc/novel-ai-writer.env`(权限 600)。

### 3.4 本地服务回环绑定

- FunASR:`scripts/start_funasr.sh` 已改为 `-p 127.0.0.1:3010:8000`(旧容器需 `docker rm` 后重建)
- ComfyUI:保持 `--listen 127.0.0.1`(现状已正确)
- CLI Proxy:确认仅监听 127.0.0.1:8317

## 4. Apache 配置

### 4.1 Web vhost(writer.example.com,新增)

```apache
<VirtualHost *:443>
    ServerName writer.example.com

    SSLEngine on
    # 证书配置同现有 mcp vhost

    ProxyRequests Off
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"

    # 必须在 catch-all / 之前明确排除 MCP 面,防止 Web 域名打到 MCP/OAuth
    ProxyPass        /mcp !
    ProxyPass        /mcp/download !
    ProxyPass        /oauth !
    ProxyPassMatch   ^/\.well-known/oauth-.* !

    ProxyTimeout 660
    ProxyPass        / http://127.0.0.1:3002/ retry=0 timeout=660
    ProxyPassReverse / http://127.0.0.1:3002/

    # SSE 流式(/api/llm/chat):禁用缓冲
    SetEnv proxy-sendchunked

    # HSTS/CSP 由应用层发送,Apache 不重复叠加亦可
</VirtualHost>
```

> `ProxyPass /mcp !` 的 `!`(排除)语法必须出现在 `ProxyPass /` **之前**,否则会被 catch-all 吞掉。

### 4.2 MCP vhost(mcp.example.com,维持现状)

仅代理 `/mcp`、`/mcp/download`、`/oauth`、`/.well-known/oauth-*`、`/health`,不代理 `/`、`/assets`、`/api/*`。现有 `docs/guides/CHATGPT_MCP_DEPLOYMENT.md` 配置不变。

### 4.3 防火墙

```bash
# 仅开放 80/443;内部服务端口全部仅回环
ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
# 验证(从另一台外网主机):
# 3002/3010/3011/8317 均 closed,只有 80/443 开放
```

### 4.4 Apache 日志脱敏

```apache
# 用 %U(不含 query string)而非 %r,避免下载令牌/搜索词进日志
LogFormat "%h %l %u %t \"%m %U protocol\" %>s %b"脱敏
CustomLog ${APACHE_LOG_DIR}/writer-access.log 脱敏
```

## 5. 备份(设计书 §42)

```bash
# 手动或 cron 每日:
./scripts/backup.sh /opt/novel-ai-writer/data     # 裸机
BACKUP_ROOT=/opt/backups ./scripts/backup.sh ...  # 自定义备份根

# cron 示例(每日 4:00):
0 4 * * * /opt/novel-ai-writer/scripts/backup.sh /opt/novel-ai-writer/data
```

- 备份含 `oauth_clients`/`oauth_tokens`/加密 API 密钥 → **高敏感**:目录 700、文件 600,离机备份必须加密
- 保留策略:**朴素轮转,保留最近 34 份**(非 14日+8周+12月分层保留;个人项目按天备份即约 34 天)
- **必须实测 restore**:`sha256sum -c` 校验 → 拷回 data 目录 → 启动 → 验证项目/插画存在

### 2.1 Docker 部署 Public 模式(支持)

`docker-compose.yml` 已透传全部 Public Web 环境变量。容器内绑定规则与裸机不同:

```text
容器内: HOST=0.0.0.0 + ALLOW_PUBLIC_CONTAINER_BIND=1(compose 已内置)
宿主侧: ports 仅发布 127.0.0.1:3002(compose 已内置,公网隔离由这一层保证)
内部服务: 容器内 127.0.0.1 指容器自身,FunASR/ComfyUI/CLI Proxy 需用 host.docker.internal
```

`.env` 中设置 `APP_MODE=public` 等变量后 `docker compose up -d --build` 即可;启动 fail-fast 校验在容器内同样生效(缺配置容器会退出,`docker logs` 可见具体缺项)。**注意:public 模式下宿主必须仍有 Apache 白名单反代,绝不可把 ports 改为发布到 0.0.0.0。**

## 6. 安全机制速查(已实现)

| 机制 | 位置 |
|---|---|
| 会话(scrypt+SHA256 哈希落库+HttpOnly Secure SameSite=Strict `__Host-nw_session`) | `src/server/web/webSession.ts` |
| /api/* 门卫(会话 401 + CSRF 403 + Origin 403;豁免 login/session 探测) | `src/server/web/webSecurity.ts` |
| 登录/接口限流、OAuth 端点限流 | `src/server/web/webRateLimit.ts` |
| LLM=2/语音=2/ComfyUI=1 并发(忙时 429+Retry-After) | `src/server/web/resourceLimits.ts` |
| Settings 白名单(write-only 密钥/server-only 地址/未知 key 400) | `src/server/routes/settings.ts`、`services/providerCredentials.ts` |
| LLM 凭据服务端解析(浏览器提交 apiKey 直接 400)+断连中止上游 | `src/server/routes/llm.ts`、`services/llmService.ts` |
| XSS:marked→DOMPurify 统一入口(4 个 v-html 组件全部替换) | `src/renderer/utils/safeMarkdown.ts` |
| 插画:metadata 写事务落盘(重启不丢)、尺寸白名单、realpath 路径囚禁 | `src/server/routes/illustrations.ts` |
| 原子 saveDB(tmp+fsync+rename) | `src/server/db/queries.ts` |
| 日志脱敏(query 不落日志,/mcp/download/[REDACTED]) | `src/server/app.ts` |
| OAuth 注册硬化(16KB 体、client_name≤128、redirect_uris≤5、限流) | `src/server/mcp/auth.ts` |
| 安全头(CSP/nosniff/no-referrer/DENY/HSTS/Permissions-Policy)+API no-store + 静态资源缓存策略 | `src/server/web/webSecurity.ts`、`app.ts` |
| 前端:启动会话门禁+LoginView+axios/fetch CSRF 拦截器+401 回登录+模型缓存版本化签名 | `src/renderer/stores/authStore.ts`、`utils/api.ts`、`App.vue` |

## 7. 自动化测试(104/104 全绿,新增 25 项)

`tests/web/publicSecurity.test.ts` 覆盖设计书 §48 验收矩阵的可自动化部分:
未登录 401/错误密码 401/登录 5 失败 429/Cookie 属性/注销即失效/CSRF 缺失·伪造·外来 Origin 全 403/正确组合写入成功/
`/api/db` 404(oauth_tokens 不可查询)/密钥不回显+configured+版本号/未知 key 400/server-only 地址 400/
chat·models 携 apiKey 400/status 不回显 baseUrl/插画尺寸 4096→400/安全头/no-store/启动校验三种场景。

## 8. 最终验收清单(设计书 §48,部署后人工执行)

```text
[ ] Network:外网主机扫描仅 80/443;3002/3010/3011/8317 closed
[ ] Web:https://writer.example.com 打开即登录页;错误密码可重试;5 次后 429
[ ] Secret:浏览器 DevTools 全局搜索各 provider key,除首次提交外 0 命中;
     GET /api/settings 响应无任何明文密钥
[ ] Database:public 下 /api/db/tables、/api/db/query 均 404
[ ] XSS:聊天让模型输出 <script>alert(1)</script> 等,chat/主旨/角色/时间线/杂项均不执行
[ ] SSRF:设置页无任何 Base URL 可改;llm/chat 带 apiKey 被 400
[ ] Streaming:LLM 首块及时;连续生成不中断;10 分钟长响应不被 Apache 截断;
     关闭页面后服务器日志显示上游被 abort
[ ] Persistence:建项目/建插画→restart→仍在;删插画→restart→仍删除
[ ] Backup:真实 backup→删数据→restore→启动→验证
[ ] MCP 回归:28 tools discovery/read/write/expected_updated_at/CONFLICT/快照/归档恢复/
     OAuth 登录/refresh 轮换//mcp/download
[ ] 补历史 Pending:公网 HTTPS MCP Inspector;真实进程重启 OAuth 免重授权 smoke
```

## 9. 升级注意(从 MCP V1 部署升级)

- 数据库新增 `web_sessions` 表(启动自动建表,无需迁移)
- `saveDB` 改为原子写:`database.db.tmp` 中间文件会短暂出现在数据目录,备份/监控白名单需知悉
- local 模式行为与 MCP V1 完全一致(存量 REST/Web 测试零改动通过)
