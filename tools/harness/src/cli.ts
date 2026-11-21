#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Harness } from './harness.js';
import { connectToServer } from './link.js';
import { serve } from './server.js';

const HELP = `Harness: runs one Game against a real server, without the Hub.

  harness serve --game <id> [--port 8040] [--server http://localhost:8033] [--client <url>]
                [--host 127.0.0.1] [--version <hash>]
      Starts the Harness: the debug page, the Bridge WebSocket (/bridge) and this CLI's API.

Commands for a running Harness (--harness <url>, default http://localhost:8040):
  create [--headless] [--options <json>]   a Room with player 0 as host
  join [--headless]                        another person at the table
  bot | remove-bot <seat>                  the server's computer player
  options <json>                           replace the Room's options (host, between Matches)
  start                                    everyone ready, the host starts a Match (also: play again)
  move <player> <event> [json]             send one of the Game's inputs as that player
  init <player>                            send the Game client a fresh init (replay)
  reconnect <player> | disconnect <player> | leave <player>
  visibility <player> hidden|visible       tell the Game client its tab was hidden or shown
  settings <player> [--volume 0-1] [--muted true|false]
  net [--latency <ms>] [--drop <0-1>]      slow network between the Harness and Game clients
  state                                    Room, Match and every player's view
  log [--since <n>] [--player <n>] [--source bridge|server|harness] [--limit <n>]
  wait --match playing|over [--timeout 10] wait until the Match reaches that status
  reset                                    everyone leaves; start over with create

A headless player has no Game client; it is moved with 'move'. Other players wait for a
Game client on ws://<harness>/bridge?player=<n>.`;

const FLAGS_WITHOUT_VALUE = new Set(['headless', 'help']);

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (FLAGS_WITHOUT_VALUE.has(name) || next === undefined || next.startsWith('--')) {
      flags[name] = 'true';
    } else {
      flags[name] = next;
      i++;
    }
  }
  return { positional, flags };
}

class UsageError extends Error {}

function json(text: string | undefined, what: string): unknown {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new UsageError(`${what} is not valid JSON: ${text}`);
  }
}

function number(text: string | undefined, what: string) {
  const value = Number(text);
  if (text === undefined || text === '' || Number.isNaN(value)) {
    throw new UsageError(`${what} must be a number`);
  }
  return value;
}

const bool = (text: string | undefined) => (text === undefined ? undefined : text !== 'false');

/** The JSON body of each command, from what was typed after its name. */
function body(command: string, positional: string[], flags: Record<string, string>): unknown {
  const player = () => ({ player: number(positional[0], 'player') });
  switch (command) {
    case 'create':
      return { headless: bool(flags.headless), options: json(flags.options, '--options') };
    case 'join':
      return { headless: bool(flags.headless) };
    case 'remove-bot':
      return { seat: number(positional[0], 'seat') };
    case 'options':
      return { options: json(positional[0], 'options') };
    case 'move': {
      const raw = positional[2];
      let payload: unknown = raw;
      try {
        payload = raw === undefined ? undefined : JSON.parse(raw);
      } catch {}
      return { ...player(), event: positional[1], payload };
    }
    case 'visibility':
      if (positional[1] !== 'hidden' && positional[1] !== 'visible') {
        throw new UsageError('visibility takes hidden or visible');
      }
      return { ...player(), hidden: positional[1] === 'hidden' };
    case 'settings':
      return {
        ...player(),
        ...(flags.volume !== undefined && { volume: number(flags.volume, '--volume') }),
        ...(flags.muted !== undefined && { muted: bool(flags.muted) }),
      };
    case 'net':
      return {
        ...(flags.latency !== undefined && { latency: number(flags.latency, '--latency') }),
        ...(flags.drop !== undefined && { drop: number(flags.drop, '--drop') }),
      };
    case 'init':
    case 'reconnect':
    case 'disconnect':
    case 'leave':
      return player();
    default:
      return {};
  }
}

async function call<T = unknown>(base: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, init);
  } catch {
    throw new UsageError(`No Harness at ${base}: start one with 'harness serve --game <id>'`);
  }
  const data = await res.json();
  if (!res.ok) throw new UsageError((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

async function wait(base: string, flags: Record<string, string>) {
  const status = flags.match;
  if (status !== 'playing' && status !== 'over') {
    throw new UsageError('wait needs --match playing or --match over');
  }
  const until = Date.now() + number(flags.timeout ?? '10', '--timeout') * 1000;
  for (;;) {
    const state = await call<{ match?: { status: string } }>(base, '/api/state');
    if (state.match?.status === status) return state;
    if (Date.now() > until) {
      console.log(JSON.stringify(state, null, 2));
      throw new UsageError(`Timed out waiting for the Match to be ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function runServe(flags: Record<string, string>) {
  const gameId = flags.game;
  if (!gameId) throw new UsageError('serve needs --game <id>');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const gameDir = `${root}games/${gameId}/dist`;
  const versionFile = `${gameDir}/version.json`;
  let version = flags.version;
  if (!version) {
    if (!existsSync(versionFile)) {
      throw new UsageError(
        `games/${gameId} is not built: run npx turbo run build --filter=@xomdao/game-${gameId}`,
      );
    }
    version = (JSON.parse(readFileSync(versionFile, 'utf8')) as { version: string }).version;
  }

  const server = (flags.server ?? process.env.XOMDAO_SERVER ?? 'http://localhost:8033').replace(
    /\/+$/,
    '',
  );
  let games: string[];
  try {
    games = (await (await fetch(`${server}/api/games`)).json()) as string[];
  } catch {
    throw new UsageError(
      `No server at ${server}. Start one without a database: DATABASE_URL= npm run dev -w @xomdao/server`,
    );
  }
  if (!games.includes(gameId)) {
    throw new UsageError(
      `The server at ${server} runs no Game "${gameId}" (it runs: ${games.join(', ') || 'none'}). Build the Game and restart the server.`,
    );
  }

  const port = flags.port ? number(flags.port, '--port') : 8040;
  const harness = new Harness({
    gameId,
    version,
    connect: connectToServer(server),
    address: `http://localhost:${port}`,
  });
  const listening = await serve(harness, {
    port,
    gameDir,
    ...(flags.host && { host: flags.host }),
    ...(flags.client && { client: flags.client }),
  });
  console.log(`Harness for ${gameId} on http://localhost:${listening.port} (server ${server})`);
  console.log(`  debug page   http://localhost:${listening.port}/`);
  console.log(`  Game client  ws://localhost:${listening.port}/bridge?player=<n>`);

  const stop = () => {
    harness
      .reset()
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  if (!command || command === 'help' || flags.help) {
    console.log(HELP);
    return;
  }
  if (command === 'serve') return runServe(flags);

  const base = (flags.harness ?? process.env.XOMDAO_HARNESS ?? 'http://localhost:8040').replace(
    /\/+$/,
    '',
  );
  let result: unknown;
  if (command === 'state') {
    result = await call(base, '/api/state');
  } else if (command === 'log') {
    const query = new URLSearchParams();
    for (const key of ['since', 'player', 'source', 'limit']) {
      if (flags[key] !== undefined) query.set(key, flags[key]);
    }
    result = await call(base, `/api/log?${query}`);
  } else if (command === 'wait') {
    result = await wait(base, flags);
  } else {
    result = await call(base, `/api/${command}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body(command, positional, flags)),
    });
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
