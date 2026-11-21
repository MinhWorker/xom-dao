import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import type { BridgePort } from '@xomdao/bridge';
import { WebSocket, WebSocketServer } from 'ws';
import { runCommand } from './commands.js';
import type { Harness } from './harness.js';
import { ServerError } from './link.js';
import type { LogEntry } from './log.js';

export interface ServeOptions {
  port: number;
  /** The address to listen on; `127.0.0.1` unless a phone on the network must reach it. */
  host?: string;
  /** The Game's built client (`games/<id>/dist`), served at `/game/` unless `client` is set. */
  gameDir: string;
  /** Where the debug page loads the Game client from instead, such as a Vite dev server. */
  client?: string;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
};

const PAGE = new URL('../public/index.html', import.meta.url);
const BODY_LIMIT = 1_000_000;

/**
 * The Bridge over a WebSocket: each text frame is one Bridge message, as JSON. The network
 * simulation delays or drops what passes in either direction, and every message is logged.
 */
function socketPort(socket: WebSocket, harness: Harness, player: () => number | null): BridgePort {
  const toGame = harness.net.lane();
  const toHub = harness.net.lane();
  const log = (dir: LogEntry['dir'], message: unknown, dropped: boolean) => {
    const { bridge: _tag, type, ...rest } = (message ?? {}) as Record<string, unknown>;
    harness.log.add({
      player: player(),
      source: 'bridge',
      dir,
      type: typeof type === 'string' ? type : 'unknown',
      ...(Object.keys(rest).length && { data: rest }),
      ...(dropped && { dropped }),
    });
  };
  return {
    post(message) {
      const sent = toGame(() => {
        log('hub→game', message, false);
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
      });
      if (!sent) log('hub→game', message, true);
    },
    listen(handler) {
      const onMessage = (raw: unknown) => {
        let message: unknown;
        try {
          message = JSON.parse(String(raw));
        } catch {
          return;
        }
        const delivered = toHub(() => {
          log('game→hub', message, false);
          handler(message);
        });
        if (!delivered) log('game→hub', message, true);
      };
      socket.on('message', onMessage);
      return () => socket.off('message', onMessage);
    },
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > BODY_LIMIT) throw new ServerError('The request is too large');
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ServerError('The request body is not JSON');
  }
}

function reply(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/** Serves `file` under `root`, or 404; never anything outside `root`. */
async function sendFile(res: ServerResponse, root: string, path: string) {
  const target = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path));
  if (target !== root && !target.startsWith(root + sep))
    return reply(res, 404, { error: 'Not found' });
  try {
    if (!(await stat(target)).isFile()) throw new Error('not a file');
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    reply(res, 404, { error: 'Not found' });
  }
}

/** Starts the Harness' HTTP API, debug page and Bridge WebSocket. Resolves once listening. */
export function serve(
  harness: Harness,
  { port, host: listenOn = '127.0.0.1', gameDir, client }: ServeOptions,
) {
  const sockets = new Map<number, WebSocket>();

  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://harness');
    const host = req.headers.host ?? `localhost:${port}`;
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': TYPES['.html'] as string });
        res.end(await readFile(PAGE));
      } else if (req.method === 'GET' && url.pathname === '/api/state') {
        reply(res, 200, {
          ...harness.state(),
          bridge: `ws://${host}/bridge`,
          client: client ?? '/game/',
        });
      } else if (req.method === 'GET' && url.pathname === '/api/log') {
        const num = (key: string) =>
          url.searchParams.has(key) ? Number(url.searchParams.get(key)) : undefined;
        const source = url.searchParams.get('source');
        reply(
          res,
          200,
          harness.entries({
            since: num('since'),
            player: num('player'),
            limit: num('limit'),
            ...(source && { source: source as LogEntry['source'] }),
          }),
        );
      } else if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        const name = url.pathname.slice('/api/'.length);
        const args = await readJson(req);
        harness.log.add({ player: null, source: 'harness', type: `command ${name}`, data: args });
        reply(res, 200, await runCommand(harness, name, args));
      } else if (req.method === 'GET' && url.pathname.startsWith('/game/')) {
        await sendFile(res, gameDir, url.pathname.slice('/game'.length));
      } else {
        reply(res, 404, { error: 'Not found' });
      }
    } catch (err) {
      reply(res, err instanceof ServerError ? 400 : 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  const bridge = new WebSocketServer({ noServer: true });
  http.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://harness');
    if (url.pathname !== '/bridge') return socket.destroy();
    bridge.handleUpgrade(req, socket, head, (ws) => {
      const wanted = url.searchParams.has('player')
        ? Number(url.searchParams.get('player'))
        : undefined;
      let seated: number | null = null;
      try {
        const taken = harness.attach(
          socketPort(ws, harness, () => seated),
          wanted,
        );
        seated = taken.player;
        sockets.get(seated)?.close(1000, 'Another Game client took this player');
        sockets.set(seated, ws);
        ws.on('close', () => {
          taken.detach();
          if (sockets.get(taken.player) === ws) sockets.delete(taken.player);
        });
      } catch (err) {
        ws.close(1008, err instanceof Error ? err.message.slice(0, 100) : 'refused');
      }
    });
  });

  return new Promise<{ port: number; close(): Promise<void> }>((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, listenOn, () => {
      const address = http.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : port,
        close: () =>
          new Promise<void>((done) => {
            for (const ws of bridge.clients) ws.terminate();
            http.close(() => done());
            http.closeAllConnections();
          }),
      });
    });
  });
}
