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
npm start
```

## Docker

```bash
docker compose up -d --build
curl http://127.0.0.1:8787/health
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
| `PF_STATIC` | `0` | 设为 `dist` 目录可同时托管客户端 |

## 端点

- `GET /health`
- `GET /api/network`
- `GET /api/rooms`
- `GET /api/servers`
- `GET /api/stats`
- `WS /ws?room=XXXX`

客户端在开始菜单「联机合作 → 局域网服务器 / 直连 WS」里填写部署后的地址即可。

## 测试

```bash
npm test
```
