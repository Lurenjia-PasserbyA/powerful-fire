# Powerful Fire Server Branch

这是 `Powerful Fire` 的服务端独立分支，只保留房间服务器与部署文件，方便直接部署到 VPS / Docker / Railway / Render。

## 包含

- `server/`：HTTP 静态托管、`/health`、`/api/network`、`/api/config`、`/api/rooms`、`/api/servers`、`/api/stats` 与 `/ws` 房间协议 v2。
- `Dockerfile`：Node 22 Alpine，单容器运行。
- `docker-compose.yml`：端口 8787、512M 内存限制。
- 默认 `PF_STATIC=0`，只提供联机 API / WebSocket；客户端可继续用单文件版或桌面包。

## 直接运行

```bash
npm install
npm start                       # 默认 nogui，仅 API / WS
node server/index.mjs --gui     # 启用 Web 控制台 /console
PF_CONSOLE_TOKEN=change-me node server/index.mjs --gui
```

## Docker

```bash
docker compose up -d --build
curl http://127.0.0.1:8787/health
```

启用 Web 控制台：

```bash
PF_GUI=1 PF_CONSOLE_TOKEN=change-me docker compose up -d --build
# 打开 http://服务器地址:8787/console?token=change-me
```

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PF_PORT` | `8787` | 监听端口 |
| `PF_HOST` | `0.0.0.0` | 监听地址 |
| `PF_REGION` | `local` | 房间列表展示区域 |
| `PF_SERVER_NAME` | `Powerful Fire Server` | 服务端名称 |
| `PF_MAX_CLIENTS` | `3` | 单房间客机上限（1 房主 + 3 客机） |
| `PF_ROOM_TTL_MS` | `900000` | 空房回收时间 |
| `PF_CORS_ORIGIN` | `*` | 允许的跨域来源 |
| `PF_GUI` | `0` | `1` 启用 Web 控制台 |
| `PF_CONSOLE_TOKEN` | 空 | 控制台令牌；为空时只允许本机回环 |
| `PF_STATIC` | `0` | 设为 `dist` 目录可同时托管客户端 |

## 端点

- `GET /health`
- `GET /api/network`
- `GET /api/rooms`
- `GET /api/servers`
- `GET /api/stats`
- `WS /ws?room=XXXX`

客户端在开始菜单「联机合作 → 局域网服务器 / 直连 WS」里填写部署后的地址即可。

## Web 控制台

`--gui` 启用 `/console`，包含 uptime、房间/玩家/连接数、房间列表与关闭操作、事件日志。管理 API：

- `GET /api/admin/status`
- `GET /api/admin/events`
- `POST /api/admin/rooms/:code/close`

未设置 `PF_CONSOLE_TOKEN` 时，控制台和 API 只接受本机请求；公网部署务必设置 token。

## 测试

```bash
npm test
```
