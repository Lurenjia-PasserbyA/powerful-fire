/**
 * 桌面多平台打包：使用 @electron/packager 生成 Windows / Linux / macOS 应用目录，
 * 再压缩为 zip，输出到 dist-app/。不依赖 Wine / macOS 签名机。
 */
import { packager } from '@electron/packager';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const outRoot = path.join(root, 'dist-app');
const rawRoot = path.join(outRoot, 'raw');
const version = '1.0.0';

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('缺少 dist/index.html，请先运行 pnpm build');
  process.exit(1);
}

fs.mkdirSync(rawRoot, { recursive: true });

const targets = [
  { platform: 'win32', arch: 'x64', label: 'windows-x64' },
  { platform: 'linux', arch: 'x64', label: 'linux-x64' },
  { platform: 'darwin', arch: 'x64', label: 'macos-x64' },
  { platform: 'darwin', arch: 'arm64', label: 'macos-arm64' },
];

const ignore = [
  /^\/src($|\/)/,
  /^\/server($|\/)/,
  /^\/android($|\/)/,
  /^\/docs($|\/)/,
  /^\/deploy($|\/)/,
  /^\/dist-app($|\/)/,
  /^\/release($|\/)/,
  /^\/\.git($|\/)/,
  /^\/node_modules($|\/)/,
  /^\/desktop\/build\.mjs$/,
  /^\/.*\.(log|zip)$/,
  /^\/Dockerfile$/,
  /^\/docker-compose\.yml$/,
  /^\/\.env\.example$/,
  /^\/pnpm-lock\.yaml$/,
];

const hashes = [];

for (const target of targets) {
  const appName = 'PowerfulFire';
  console.log(`[pack] ${target.label}…`);
  const [appDir] = await packager({
    dir: root,
    out: rawRoot,
    platform: target.platform,
    arch: target.arch,
    name: appName,
    appVersion: version,
    overwrite: true,
    prune: true,
    asar: false,
    ignore,
    win32metadata: {
      CompanyName: 'Powerful Fire',
      FileDescription: 'Powerful Fire',
      ProductName: 'Powerful Fire',
    },
  });

  const zipName = `PowerfulFire-${version}-${target.label}.zip`;
  const zipPath = path.join(outRoot, zipName);
  fs.rmSync(zipPath, { force: true });
  execFileSync('zip', ['-qr', zipPath, path.basename(appDir)], { cwd: rawRoot });

  const hash = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
  hashes.push(`${hash}  ${zipName}`);
  console.log(`[pack] ${zipName} ${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(1)}MB`);
}

fs.writeFileSync(path.join(outRoot, 'SHA256SUMS-desktop.txt'), `${hashes.join('\n')}\n`);
fs.writeFileSync(
  path.join(outRoot, 'desktop-build.json'),
  JSON.stringify({ version, builtAt: new Date().toISOString(), targets }, null, 2),
);
console.log('[pack] desktop packages ready in dist-app/');
