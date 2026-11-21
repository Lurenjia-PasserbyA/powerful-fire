/**
 * 启动入口：pnpm server / node server/index.mjs
 * 环境变量见 server/config.mjs 与 docs/SERVER.md。
 */
import { pathToFileURL } from 'node:url';
import { createPfServer } from './app.mjs';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const server = createPfServer();
  server
    .start()
    .then(() => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : server.config.port;
      console.log(
        `[pf-server] v${server.config.version} listening on http://${server.config.host}:${port} (ws://…/ws)`,
      );
      console.log(`[pf-server] static: ${server.config.staticDir ?? 'disabled'} · maxPlayers=${1 + server.config.maxClients}`);
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
