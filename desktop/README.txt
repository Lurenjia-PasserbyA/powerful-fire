# Powerful Fire Desktop

这是 Powerful Fire 的桌面版，内置本地静态服务器，双击启动即可游玩。

- Windows：解压后运行 `PowerfulFire.exe`
- Linux：解压后运行 `PowerfulFire`（可能需要 `chmod +x PowerfulFire`）
- macOS：解压后打开 `PowerfulFire.app`（首次运行可能需要在「系统设置 → 隐私与安全性」允许；若提示已损坏，可在终端执行 `xattr -dr com.apple.quarantine PowerfulFire.app`，本包未做 Apple 公证）

联机：进入游戏后点击右上角 `⇄` 打开联机大厅，选择「服务器」，填写专用服务器地址（如 `https://pf.example.com`）。

数据保存在本机 IndexedDB（Electron 用户数据目录），卸载应用前可先导出存档。
