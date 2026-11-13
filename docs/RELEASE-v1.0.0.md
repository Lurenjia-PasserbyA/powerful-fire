# Powerful Fire v1.0.0

2D 俯视角火系动作 RPG 的正式版。M1–M8 的玩法、基地/体力、音频、存档与联机全部保留，v1.0 补齐正式服务端、服务器大厅、三生物群系、移动端触控与四端应用包。

## 亮点

### 正式服务端

- `server/config.mjs` + `server/app.mjs` + `server/index.mjs` 分层，单进程提供静态托管、HTTP API 与 WebSocket 房间服务。
- API：`/health`、`/api/config`、`/api/rooms`、`/api/servers`、`/api/stats`；WS：`/ws`，协议 v2。
- 房间规则：房间码 2–8 位、昵称 12 字、容量房主 + 3 客机、64KB 限包、240 msg/s 限流、20s 心跳、房主断线 10s 宽限、客机重连令牌 45s、空房 15min 回收。
- 部署：`Dockerfile`（多阶段 + HEALTHCHECK）、`docker-compose.yml`、systemd unit、Nginx TLS 示例，详见 `docs/SERVER.md`。
- 测试：`pnpm test:server` → `node --test` 4/4 通过（健康/发现、注册转发、容量上限、重连令牌）。

### 多连接方式与联机大厅

- HUD「⇄」大厅提供「本机 / 直连 / 服务器」三个 Tab。
- 服务器 Tab 支持发现列表、延迟探测、公开房间列表、最近服务器、复制邀请链接。
- URL 参数向后兼容：`?net=host|join|client|server`；不填地址时走同浏览器 BroadcastChannel。
- 房主每 2s 同步群系/波次 meta；客机掉线自动 3 次退避重连；HUD chip 显示模式、人数与延迟。

### 三生物群系

| 群系 | 区域 | 特性 |
| --- | --- | --- |
| 灰烬荒原 ember | 全图基底 | 基础敌人池，基地 0–560 恒为安全区 |
| 焦木林 grove | x1100 y1900 w2100 h2400 | 5 处雾圈，移速 ×0.62；thornhusk / cinderling |
| 熔岩裂谷 rift | x3300 y600 w1700 h2400 | 6 处岩浆圈，9 DPS；magmaw / lavaback |

新增 emberling / thornhusk / cinderling / magmaw / lavaback 五种敌人；地面渲染加入群系色块、边界、危害圈、区域标题；HUD 显示群系名并提示「进入 XX」。

### 触控重写

- 左半屏任意位置浮动摇杆；右半屏拖动瞄准并持续开火。
- 大号闪避 / 大招、自动开火开关、商店按钮、体力条、三槽位、震动反馈、竖屏提示。
- 自动开火时以 20° 锥形辅助瞄准最近敌人；`?touch=1` 可强制启用。

### 四端应用包

| 平台 | 资产 |
| --- | --- |
| Windows x64 | `PowerfulFire-1.0.0-windows-x64.zip` |
| Linux x64 | `PowerfulFire-1.0.0-linux-x64.zip` |
| macOS Intel | `PowerfulFire-1.0.0-macos-x64.zip` |
| macOS Apple Silicon | `PowerfulFire-1.0.0-macos-arm64.zip` |
| Android | `PowerfulFire-1.0.0-android-debug.apk` |

桌面壳使用 Electron，内置随机端口 HTTP 服务托管 `dist/`，避免 `file://` 的模块限制；关闭窗口即释放端口。
Android 工程由 Capacitor 8 生成，`applicationId com.powerfulfire.game`，minSdk 24 / targetSdk 36。

## 验收记录

- `pnpm typecheck` 通过；`pnpm build` 通过。
- 服务端 8787 实测：`/health` 返回 `{ok:true,version:"1.0.0",protocol:2}`，`/api/servers` 返回本机条目，`/` 返回 200 并加载客户端。
- 浏览器实测：启动 HUD「WAVE · 灰烬荒原」；传送至焦木林 `envSlow=0.62`；传送至熔岩裂谷持续掉血（95.5 → 51）。
- 触控实测：合成 PointerEvent 拖动左区 `input.move.x≈0.86`，松手归零；右区按下 `fireHeld=true`，松手为 false。
- 联机大厅实测：服务器发现显示 `Powerful Fire Server · local · 0/4P · 14ms`；创建房间 V1A 后 `/api/rooms` 返回 1 房 1 人。
- Android：`assembleDebug` 成功，APK 5.3MB，`aapt2` 校验包名/版本正确，内含最新 `assets/public`。

## 已知限制

- macOS 包未做 Apple Developer 签名与公证，首次打开需在「隐私与安全性」放行；如提示损坏可执行 `xattr -dr com.apple.quarantine PowerfulFire.app`。
- Windows/Linux/macOS 目前为 zip 应用包，不是安装器（无 NSIS/AppImage/dmg）。
- Android 为 debug 签名 APK，适合内测；上架商店需配置 release keystore。
- 桌面包在无显示器的 Linux 构建机上完成打包与内容校验，未做 GUI 启动冒烟；首次在目标系统运行请留意安全软件提示。
- 公网正式服仍需自备域名、TLS 与反向代理；仓库内提供 Docker/systemd/Nginx 模板，未代用户部署到具体云主机。
