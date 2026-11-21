/**
 * 启动入口：pnpm server / node server/index.mjs
 * 环境变量见 server/config.mjs 与 docs/SERVER.md。
 */
import { pathToFileURL } from 'node:url';
import { createPfServer } from './app.mjs';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

function usage() {
  console.log(`Powerful Fire Server

用法:
  node server/index.mjs --gui            启用 Web 控制台 /console
  node server/index.mjs --nogui         纯 API/WS，无控制台（默认）
  node server/index.mjs --port=8787     覆盖监听端口
  node server/index.mjs --host=0.0.0.0  覆盖监听地址
  node server/index.mjs --static=0      关闭静态客户端托管

环境变量:
  PF_GUI=1|0  PF_CONSOLE_TOKEN=xxx  PF_PORT=8787  PF_STATIC=dist
`);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[i + 1];
    const key = arg.split('=')[0];
    if (arg === '--gui') options.gui = true;
    else if (arg === '--nogui') options.gui = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (key === '--port') { options.port = Number(value); if (!arg.includes('=')) i += 1; }
    else if (key === '--host') { options.host = String(value); if (!arg.includes('=')) i += 1; }
    else if (key === '--static') { options.staticDir = value === '0' ? null : value; if (!arg.includes('=')) i += 1; }
    else if (key === '--console-token') { options.consoleToken = String(value ?? ''); if (!arg.includes('=')) i += 1; }
    else throw new Error(`未知参数: ${arg}`);
  }
  return options;
}

if (isMain) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[pf-server] ${error.message}`);
    usage();
    process.exit(1);
  }
  if (options.help) {
    usage();
    process.exit(0);
  }
  const server = createPfServer(options);
  server
    .start()
    .then(() => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : server.config.port;
      console.log(
        `[pf-server] v${server.config.version} listening on http://${server.config.host}:${port} (ws://…/ws)`,
      );
      console.log(`[pf-server] static: ${server.config.staticDir ?? 'disabled'} · maxPlayers=${1 + server.config.maxClients} · gui=${server.config.gui ? 'on' : 'off'}`);
      if (server.config.gui) {
        console.log(`[pf-server] console: http://${server.config.host}:${port}/console${server.config.consoleToken ? '?token=…' : ' (loopback only)'}`);
        if (!server.config.consoleToken) console.log('[pf-server] 提示: 远程访问控制台请设置 PF_CONSOLE_TOKEN');
      }
    })
    .catch((error) => {
      console.error('[pf-server] failed to start', error);
      process.exitCode = 1;
    });

  const shutdown = (signal) => {
    console.log(`[pf-server] ${signal} received, shutting down…`);
    server.stop().finally(() => process.exit(0));
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

export { createPfServer } from './app.mjs';
