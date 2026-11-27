import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const dir = new URL('dist-single/', root);
let html = readFileSync(new URL('index.html', dir), 'utf8');
const jsPath = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).at(-1);
const cssPath = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]).at(-1);
if (!jsPath || !cssPath) throw new Error('missing build assets');
const js = readFileSync(new URL(jsPath.replace(/^\//, ''), dir), 'utf8');
const css = readFileSync(new URL(cssPath.replace(/^\//, ''), dir), 'utf8').replace(/<\/style/gi, '<\\/style');
const styleTag = `<style>${css}</style>`;
const scriptTag = `<script type="module">\n${js}\n</script>`;
let output = html
  .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/i, styleTag)
  .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/i, scriptTag)
  .replace('<title>Powerful Fire</title>', '<title>Powerful Fire — 单文件沙箱版</title>');
writeFileSync(new URL('PowerfulFire-inline.html', root), output);
console.log(`[inline] ${Buffer.byteLength(output)} bytes, js ${Buffer.byteLength(js)} css ${Buffer.byteLength(css)}`);
