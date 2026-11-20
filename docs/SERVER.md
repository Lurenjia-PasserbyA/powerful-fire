# Powerful Fire 服务器（v1.0）

专用服务器负责 **客户端托管 + 房间发现 + WebSocket 转发**，不参与游戏模拟。浏览器房主仍是唯一权威端（host-authoritative），因此服务器无状态、可水平扩展，宕机不会影响单机与同浏览器联机。

```
浏览器房主 ──WS──┐
浏览器客机 ──WS──┼──> Powerful Fire Server ──> /api/rooms 房间列表
浏览器观战/大厅 ──┘        │
                           └── dist/ 静态客户端（可选同源托管）
```

## 能力

| 能力 | 说明 |
| --- | --- |
| 静态托管 | 自动托管 `dist/`，SPA 回退 `index.html`，`assets/*` 长缓存 |
| 健康检查 | `GET /health` 返回版本、协议、房间数、玩家数、uptime |
| 房间发现 | `GET /api/rooms?joinable=1` 返回房间码、人数、容量、群系、波次 |
| 服务器发现 | `GET /api/servers` 返回自身与 `PF_ADVERTISE` 对等服务器 |
| 局域网地址 | `GET /api/network` 返回本机非回环 IPv4 与推荐地址，开始菜单据此预填 |
| 客户端配置 | `GET /api/config` 返回协议版本、人数上限、快照/输入频率 |
| 房间生命周期 | 房主断线保留 10s，空房 15min 回收，客户端断线令牌保留 45s |
| 容量控制 | 默认房主 + 3 客机 = 4 人；第 5 人收到 `room-full` |
| 心跳 | 20s WebSocket ping/pong，失活连接自动清理 |
| 限流/限包 | 64KB 最大消息、单连接 240 msg/s、昵称/房间码校验 |

## 启动

```bash
pnpm install
pnpm build                 # 产出 dist/
pnpm server                # http://0.0.0.0:8787 + ws://…/ws
# 或
PF_PORT=9000 PF_REGION=cn-east pnpm server
```

无 `dist/` 时服务器仍可运行，只提供 API 与 WebSocket。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PF_PORT` / `PORT` | `8787` | HTTP + WS 端口 |
| `PF_HOST` | `0.0.0.0` | 监听地址 |
| `PF_PROTOCOL` | `2` | 协议版本，不匹配直接关闭连接 |
| `PF_MAX_CLIENTS` | `3` | 客机上限（1–3），总人数 +1 |
| `PF_MAX_ROOMS` | `500` | 房间上限 |
| `PF_ROOM_TTL_MS` | `900000` | 空房回收时间 |
| `PF_HOST_GRACE_MS` | `10000` | 房主断线保留时间 |
| `PF_RECONNECT_MS` | `45000` | 客机重连令牌有效期 |
| `PF_HEARTBEAT_MS` | `20000` | 心跳间隔 |
| `PF_STATIC` | `dist` | 静态目录；`0` 关闭 |
| `PF_CORS_ORIGIN` | `*` | CORS 来源，生产建议收敛到游戏域名 |
| `PF_ADVERTISE` | 空 | 逗号分隔的对等服务器 URL |
| `PF_SERVER_NAME` | `Powerful Fire Server` | 大厅显示名 |
| `PF_REGION` | `local` | 区域标识 |

## HTTP API

```http
GET /health
{"ok":true,"name":"powerful-fire-server","version":"1.0.0","protocol":2,"uptimeMs":1234,"rooms":1,"players":2,"region":"local"}

GET /api/rooms?joinable=1
{"rooms":[{"code":"PFM7","players":2,"capacity":4,"joinable":true,"host":"Host","biome":"ember","wave":3,"mode":"coop","ageMs":12000}],"roomCount":1,"playerCount":2}

GET /api/servers
{"servers":[{"id":"self-local","name":"Powerful Fire Server","url":"http://host:8787","ws":"ws://host:8787/ws","players":2,"rooms":1,"capacity":4,"version":"1.0.0","official":true}]}
```

## WebSocket 协议

连接：`ws://host:8787/ws`。所有消息为 JSON。

注册（客户端/房主都必须先注册）：

```json
{"type":"register","protocol":2,"room":"PFM7","role":"lan-host","name":"Host"}
{"type":"register","protocol":2,"room":"PFM7","role":"lan-client","name":"Guest","token":"<可选重连令牌>"}
```

注册响应（包在 `{from:"server",data:{…}}`）：

```json
{"type":"register-ok","role":"client","id":"c1","token":"…","room":"PFM7","roomInfo":{…}}
{"type":"register-error","code":"room-full|room-taken|bad-room|protocol-mismatch|server-full"}
```

游戏消息沿用 M7 封装：

```json
{"to":"all","data":{"type":"snapshot","snapshot":{…}}}
{"to":"c1","data":{"type":"welcome",…}}
{"data":{"type":"input","input":{…}}}
```

服务器附加消息：`server-info`、`room-state`、`pong`、`host-left`。
房主可发 `{"type":"meta","meta":{"biome":"grove","wave":5}}` 更新大厅展示。

## 部署

### Docker Compose（推荐）

```bash
docker compose up -d --build
curl http://127.0.0.1:8787/health
```

`docker-compose.yml` 会构建客户端并同源托管，端口 `8787`。

### systemd

```bash
sudo useradd -r -s /bin/false pf
sudo mkdir -p /opt/powerful-fire && sudo chown -R pf:pf /opt/powerful-fire
# 把 dist/、server/、package.json、node_modules 放进去
sudo cp deploy/powerful-fire-server.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now powerful-fire-server
```

### Nginx + TLS

```nginx
server {
  listen 443 ssl;
  server_name pf.example.com;
  ssl_certificate     /etc/letsencrypt/live/pf.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/pf.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host $host;
  }

  location /ws {
    proxy_pass http://127.0.0.1:8787/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
  }
}
```

HTTPS 下客户端会自动把 `http(s)` 地址转成 `ws(s)`。

## 容量与扩展

- 单房间 4 人、20Hz 快照，单实例可承载数百房间；瓶颈是 WebSocket 连接数与出口带宽。
- 服务器无共享状态也可工作；多实例做大厅时，把 `/api/rooms` 汇总到网关，或后续接入 Redis 房间索引。
- 房间码 2–8 位 `A-Z0-9_-`，建议客户端生成 4–6 位随机码避免碰撞。
- 生产建议：限制 `PF_CORS_ORIGIN`、前置 Nginx 限流、开启 TLS、容器内存限制 256–512MB。

## 安全

- 不信任客户端消息：所有字段服务端校验/截断；非法 JSON 丢弃。
- 重连令牌只返回给对应连接，不进入房间列表。
- 服务器不存储任何玩家账号或存档；存档仍在客户端 IndexedDB。
- 若需公网大厅，建议增加房间密码、举报与昵称过滤（当前版本仅基础清洗）。

## 测试

```bash
pnpm test:server
```

覆盖：健康检查/发现 API、房主+客机注册与双向转发、房间列表、容量上限、重连令牌恢复同一 client id。

## 后续路线

1. 房间密码与好友邀请链接。
2. Redis 房间索引 + 多区域大厅聚合。
3. 可选 relay 侧快照广播（降低房主上行）。
4. 专用进程托管无头模拟（服务器权威），替换浏览器房主。
5. 指标导出（Prometheus `/metrics`）与结构化日志。
