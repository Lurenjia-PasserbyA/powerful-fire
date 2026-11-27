import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const dir = new URL('dist-single/', root);
const html = readFileSync(new URL('index.html', dir), 'utf8');
const jsPath = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).at(-1);
const cssPath = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]).at(-1);
if (!jsPath || !cssPath) throw new Error('missing build assets');
const js = readFileSync(new URL(jsPath.replace(/^\//, ''), dir), 'utf8');
const css = readFileSync(new URL(cssPath.replace(/^\//, ''), dir), 'utf8');

const inline = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Powerful Fire — iframe 单文件版</title>
<style>${css.replace(/<\/style/gi, '<\\/style')}</style>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#08070c}#app{width:100%;height:100%}</style>
</head>
<body>
${html
  .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/i, '')
  .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/i, '')
  .replace('</body>', `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>`)}
</html>`;

writeFileSync(new URL('PowerfulFire-iframe.html', root), inline);
console.log(`[inline] html bytes ${Buffer.byteLength(inline)}`);
