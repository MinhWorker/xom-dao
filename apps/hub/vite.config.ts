import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const games = resolve(dirname(fileURLToPath(import.meta.url)), '../../games');
const version = (
  JSON.parse(readFileSync(resolve(games, '../package.json'), 'utf8')) as { version: string }
).version;
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
        if (file !== root && !file.startsWith(root + sep)) return next();
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
          filter: (src) => {
            const server = join(games, id, 'dist/server');
            return src !== server && !src.startsWith(server + sep);
          },
        });
      }
    },
  };
}

const images = resolve(games, '../assets/app/images');

/** Serves /avatars/<id>.webp, the accounts' pictures Games show, in dev and copies them into the build. */
function avatarImages(): Plugin {
  let outDir = 'dist';
  const avatars = () => readdirSync(images).filter((f) => /^avatar-[a-z0-9-]+\.webp$/.test(f));
  return {
    name: 'xomdao-avatar-images',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(dev) {
      dev.middlewares.use('/avatars', async (req, res, next) => {
        const { readFile } = await import('node:fs/promises');
        const name = `avatar-${(req.url ?? '').split('?')[0]?.replace(/^\//, '')}`;
        if (!avatars().includes(name)) return next();
        res.setHeader('Content-Type', 'image/webp');
        res.end(await readFile(join(images, name)));
      });
    },
    closeBundle() {
      for (const file of avatars())
        cpSync(join(images, file), join(outDir, 'avatars', file.slice('avatar-'.length)));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), gameBundles(), avatarImages()],
  resolve: { conditions: ['xomdao-source'] },
  define: {
    /** The repo's version, which release-please keeps. */
    __APP_VERSION__: JSON.stringify(version),
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
