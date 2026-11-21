import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const dir = new URL('dist-single/', root);
let html = readFileSync(new URL('index.html', dir), 'utf8');

// 把构建产物压成一段 gzip + base64，运行时用浏览器原生 DecompressionStream 还原。
const jsPath = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).at(-1);
const cssPath = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]).at(-1);
if (!jsPath || !cssPath) throw new Error('missing build assets');
const js = readFileSync(new URL(jsPath.replace(/^\//, ''), dir));
const css = readFileSync(new URL(cssPath.replace(/^\//, ''), dir), 'utf8').replace(/<\/style/gi, '<\\/style');
const packed = gzipSync(js, { level: 9 }).toString('base64');

const loader = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Powerful Fire — 单文件版</title>
<style>${css}</style>
<style>
  .single-file-boot{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#08070c;color:#ffb347;font:600 14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}
  .single-file-boot p{max-width:80vw;text-align:center}
</style>
</head>
<body>
<div id="single-file-boot" class="single-file-boot"><p>正在解包 Powerful Fire…</p></div>
<script id="pf-pack" type="application/octet-stream">${packed}</script>
<script>
(async () => {
  const boot = document.getElementById('single-file-boot');
  try {
    const b64 = document.getElementById('pf-pack').textContent.trim();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (!('DecompressionStream' in window)) throw new Error('当前浏览器不支持 DecompressionStream，请使用 Chrome / Edge / Safari 16.4+');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const code = await new Response(stream).text();
    const blob = new Blob([code], { type: 'text/javascript' });
    const script = document.createElement('script');
    script.type = 'module';
    script.src = URL.createObjectURL(blob);
    script.onload = () => { URL.revokeObjectURL(script.src); boot.remove(); };
    script.onerror = () => { boot.innerHTML = '<p>启动失败：脚本被浏览器拦截。<br>请通过本地 HTTP 服务打开，或使用 Chrome / Edge。</p>'; };
    document.body.appendChild(script);
  } catch (error) {
    boot.innerHTML = '<p>启动失败：' + String(error && error.message || error) + '</p>';
  }
})();
</script>
${html.replace(/<link[^>]+href="[^"]+\.css"[^>]*>/i, '').replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/i, '')}
</body>
</html>`;

writeFileSync(new URL('PowerfulFire-single.html', root), loader);
console.log(`[single] ${packed.length} base64 chars, html bytes ${Buffer.byteLength(loader)}`);
