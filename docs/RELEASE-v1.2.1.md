# Powerful Fire v1.2.1 — 伤害数字坐标修复

发布日期：2026-11-21

v1.2.1 是 v1.2.0 的补丁版本：修复伤害数字在非 1280×720 窗口、手机缩放和不同宽高比下位置偏移的问题。

## 修复

- HUD 本地坐标使用 `CSS 像素 / hudScale`，相机换算结果使用设计逻辑坐标；此前直接把逻辑坐标写进 HUD，导致数字随窗口尺寸与 HUD 缩放产生偏移。
- `FloatingTextLayer.sync` 增加 `viewport.scale / hudScale` 换算，伤害数字现在会准确落在受击目标上方。
- 桌面 1920×1080、1280×720，以及手机横屏/竖屏视口下统一生效。

## 验证

- 1920×1080：构造世界坐标 `x + 100` 的伤害数字，DOM 实际屏幕中心与理论值偏差 < 0.1 px。
- `pnpm typecheck`、`pnpm build`、`pnpm test:server` 4/4 通过。
- 四端桌面包与 Android APK 已重打。

## 应用包

| 平台 | 文件 |
| --- | --- |
| Windows x64 | `PowerfulFire-1.2.1-windows-x64.zip` |
| Linux x64 | `PowerfulFire-1.2.1-linux-x64.zip` |
| macOS x64 | `PowerfulFire-1.2.1-macos-x64.zip` |
| macOS arm64 | `PowerfulFire-1.2.1-macos-arm64.zip` |
| Android | `PowerfulFire-1.2.1-android-debug.apk` |
| 单文件浏览器版 | `PowerfulFire-single.html`（约 344 KB） |

SHA256 见 `SHA256SUMS-1.2.1.txt`。
