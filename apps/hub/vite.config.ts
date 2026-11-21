// The Hub: a React SPA at `/`, with each Game's bundle (games/<id>/dist/) at /games/<id>/.
// XOMDAO_SERVER_URL bakes in where the server is; without it the Hub calls its own origin, and
// the dev server forwards /api and /ws to XOMDAO_DEV_SERVER (default http://localhost:8033).
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const games = resolve(dirname(fileURLToPath(import.meta.url)), '../../games');
const server = process.env.XOMDAO_SERVER_URL ?? '';
const devServer = process.env.XOMDAO_DEV_SERVER ?? 'http://localhost:8033';

/** Games that ship to the Hub: a manifest and a built bundle. */
function gameIds() {
  return readdirSync(games).filter(
    (id) =>
      existsSync(join(games, id, 'manifest.ts')) && existsSync(join(games, id, 'dist/index.html')),
  );
}

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
};

/** Serves /games/<id>/ from games/<id>/dist/ in dev and copies it into the build. */
function gameBundles(): Plugin {
  let outDir = 'dist';
  return {
    name: 'xomdao-game-bundles',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(dev) {
      dev.middlewares.use('/games', async (req, res, next) => {
        const { readFile } = await import('node:fs/promises');
        const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
        const [, id, ...rest] = path.split('/');
        if (!id) return next();
        const root = join(games, id, 'dist');
        let file = normalize(join(root, ...rest));
        if (!file.startsWith(root)) return next();
        if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const ext = file.slice(file.lastIndexOf('.'));
        res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
        res.end(await readFile(file));
      });
    },
    closeBundle() {
      for (const id of gameIds()) {
        cpSync(join(games, id, 'dist'), join(outDir, 'games', id), {
          recursive: true,
          filter: (src) => !src.startsWith(join(games, id, 'dist/server')),
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), gameBundles()],
  resolve: { conditions: ['xomdao-source'] },
  define: {
    __SERVER_URL__: JSON.stringify(server.replace(/\/$/, '')),
    /** `wip` Games show in dev and PR previews, never in production. */
    __SHOW_WIP__: JSON.stringify(mode !== 'production' || process.env.VERCEL_ENV !== 'production'),
  },
  server: {
    port: Number(process.env.HUB_PORT ?? 8030),
    host: true,
    proxy: {
      '/api': devServer,
      '/ws': { target: devServer.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
}));
