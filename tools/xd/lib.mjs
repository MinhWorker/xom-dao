// xd's plumbing: where sessions, accounts and the dev server are kept (.xd/), the line-JSON
// channel to a running client (apps/client/core/xd_server.gd), and starting things.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { client, godot, requireGodot, root } from '../godot/lib.mjs';
import { link } from '../godot/link.mjs';

export const home = join(root, '.xd');
const sessionsDir = join(home, 'sessions');
const serverFile = join(home, 'server.json');
const accountsFile = join(home, 'accounts.json');

export class XdError extends Error {}

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

/** Kills a process group started detached (Godot under xvfb-run, npm under node). */
export async function kill(pid) {
  if (!alive(pid)) return;
  for (const signal of ['SIGTERM', 'SIGKILL']) {
    try {
      process.kill(-pid, signal);
    } catch {
      try {
        process.kill(pid, signal);
      } catch {}
    }
    for (let i = 0; i < 30 && alive(pid); i += 1) await delay(100);
    if (!alive(pid)) return;
  }
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export function tail(path, lines = 40) {
  try {
    return readFileSync(path, 'utf8').split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}

// ── Server ──────────────────────────────────────────────────────────────────────────────────

async function healthy(url) {
  try {
    const reply = await fetch(new URL('/api/health', url), { signal: AbortSignal.timeout(1500) });
    return reply.ok;
  } catch {
    return false;
  }
}

export function serverInfo() {
  const info = readJson(serverFile);
  return info && alive(info.pid) ? info : null;
}

/** The server to talk to: --server, XD_SERVER, xd's own dev server, or the usual :8033. */
export async function serverUrl(flag) {
  const wanted = flag ?? process.env.XD_SERVER;
  if (wanted) return wanted.replace(/\/$/, '');
  const own = serverInfo();
  if (own && (await healthy(own.url))) return own.url;
  if (await healthy('http://localhost:8033')) return 'http://localhost:8033';
  throw new XdError('No server is up. Start one with: npm run xd -- server start');
}

/** Starts the dev server (dev commands on, accounts in memory) on a free port. */
export async function startServer({ port, botDelay } = {}) {
  const running = serverInfo();
  if (running) return { ...running, already: true };
  const chosen = port ?? (await freePort());
  const log = join(home, 'server.log');
  mkdirSync(home, { recursive: true });
  const fd = openSync(log, 'w');
  const child = spawn('npm', ['run', 'dev:server'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: {
      ...process.env,
      PORT: String(chosen),
      DATABASE_URL: '',
      XOMDAO_DEV: '1',
      ...(botDelay && { BOT_DELAY_MS: String(botDelay) }),
    },
  });
  closeSync(fd);
  child.unref();
  const info = { pid: child.pid, port: chosen, url: `http://localhost:${chosen}`, log };
  writeJson(serverFile, info);
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await healthy(info.url)) return info;
    if (!alive(child.pid)) break;
    await delay(300);
  }
  await kill(child.pid);
  rmSync(serverFile, { force: true });
  throw new XdError(`The dev server did not come up.\n${tail(log)}`);
}

export async function stopServer() {
  const info = readJson(serverFile);
  if (info) await kill(info.pid);
  rmSync(serverFile, { force: true });
  return info;
}

// ── Accounts ────────────────────────────────────────────────────────────────────────────────

async function auth(url, path, body) {
  const reply = await fetch(new URL(`/api/auth/${path}`, url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await reply.json().catch(() => ({}));
  return reply.ok && data.token ? data : { message: data.message ?? `HTTP ${reply.status}` };
}

/** A username for an xd account name: letters and digits, 3 to 20 of them. */
function usernameFor(name, attempt) {
  const base = `xd${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 16);
  return attempt === 0 ? base.padEnd(3, '0') : `${base}${attempt}`.slice(0, 20);
}

/**
 * Logs in as the xd account `name` on this server, registering it first when needed; the
 * login is remembered in .xd/accounts.json per server. Returns { username, name, token, user }.
 */
export async function account(url, name, { display } = {}) {
  const all = readJson(accountsFile, {});
  const known = all[url]?.[name];
  if (known) {
    const login = await auth(url, 'login', { username: known.username, password: known.password });
    if (login.token) return { ...known, token: login.token, user: login.user };
  }
  const password = known?.password ?? randomBytes(12).toString('hex');
  const shown = (display ?? name).slice(0, 20);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = usernameFor(name, attempt);
    const made = await auth(url, 'register', {
      username,
      password,
      name: shown,
      avatar: 'boy',
    });
    if (made.token) {
      all[url] = { ...all[url], [name]: { username, password, name: shown } };
      writeJson(accountsFile, all);
      return { username, password, name: shown, token: made.token, user: made.user };
    }
    if (!/tồn tại|đã có|taken|exists/i.test(made.message)) {
      throw new XdError(`Could not make account ${name}: ${made.message}`);
    }
  }
  throw new XdError(`Could not find a free username for ${name}`);
}

export function accounts(url) {
  return readJson(accountsFile, {})[url] ?? {};
}

// ── Sessions ────────────────────────────────────────────────────────────────────────────────

const sessionFile = (name) => join(sessionsDir, `${name}.json`);

export function sessionLog(name) {
  return join(sessionsDir, `${name}.log`);
}

export function readSession(name) {
  const info = readJson(sessionFile(name));
  if (!info) return null;
  return { ...info, running: alive(info.pid) };
}

export function sessions() {
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => readSession(file.slice(0, -5)))
    .filter(Boolean);
}

function hasXvfb() {
  return spawnSync('sh', ['-c', 'command -v xvfb-run'], { stdio: 'ignore' }).status === 0;
}

/** Imports changed resources (new images, sounds) before a run; scripts need no import. */
export function importResources() {
  const result = godot(['--import']);
  if (result.status !== 0) throw new XdError(`Godot import failed.\n${result.output.slice(-4000)}`);
}

/**
 * Starts a desktop debug client as session `name`, logged in as the xd account `as`, and waits
 * until it answers. Under xvfb-run when it is installed (no window), else a window.
 */
export async function launch(options) {
  const { name, as, server, size = '1280x720', visible = false, args = [] } = options;
  const old = readSession(name);
  if (old?.running) throw new XdError(`Session ${name} is already running (pid ${old.pid})`);
  link();
  const login = await account(server, as);
  const port = await freePort();
  const key = randomBytes(16).toString('hex');
  const index = sessions().filter((s) => s.running).length;
  const [width, height] = size.split('x').map(Number);
  const godotArgs = [
    '--path',
    client,
    '--windowed',
    '--resolution',
    `${width}x${height}`,
    '--position',
    `${40 + index * 48},${40 + index * 48}`,
    '--',
    `--xd-port=${port}`,
    `--xd-key=${key}`,
    `--xd-profile=${name}`,
    `--xd-token=${login.token}`,
    ...args,
  ];
  const hidden = !visible && hasXvfb();
  const [command, commandArgs] = hidden
    ? ['xvfb-run', ['-a', '-s', '-screen 0 2560x1600x24', requireGodot(), ...godotArgs]]
    : [requireGodot(), godotArgs];
  mkdirSync(sessionsDir, { recursive: true });
  const log = sessionLog(name);
  const fd = openSync(log, 'w');
  const child = spawn(command, commandArgs, {
    cwd: root,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, XOMDAO_SERVER: `${server.replace(/^http/, 'ws')}/ws` },
  });
  closeSync(fd);
  child.unref();
  const info = {
    name,
    pid: child.pid,
    port,
    key,
    server,
    as,
    username: login.username,
    size: `${width}x${height}`,
    hidden,
    args,
    started: new Date().toISOString(),
  };
  writeJson(sessionFile(name), info);
  try {
    await waitUp(info);
  } catch (error) {
    await kill(child.pid);
    throw error;
  }
  return info;
}

async function waitUp(info, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    if (!alive(info.pid)) break;
    try {
      last = await call(info, 'ping', {}, 2000);
      if (!['boot', 'status'].includes(last.scene)) return last;
    } catch {}
    await delay(200);
  }
  const why = alive(info.pid) ? `still on ${last?.scene ?? 'no answer'}` : 'it exited';
  throw new XdError(
    `Session ${info.name} did not come up (${why}).\n${tail(sessionLog(info.name))}`,
  );
}

/** Changes what a session file remembers (after `login`, the account a restart logs in as). */
export function updateSession(name, patch) {
  const info = readJson(sessionFile(name));
  if (info) writeJson(sessionFile(name), { ...info, ...patch });
}

export async function stopSession(name) {
  const info = readSession(name);
  if (!info) return null;
  if (info.running) {
    try {
      await call(info, 'quit', {}, 2000);
      for (let i = 0; i < 20 && alive(info.pid); i += 1) await delay(100);
    } catch {}
    await kill(info.pid);
  }
  rmSync(sessionFile(name), { force: true });
  return info;
}

// ── The channel ─────────────────────────────────────────────────────────────────────────────

let nextId = 1;

/** Sends one command to a running session and resolves with its result. */
export function call(info, cmd, args = {}, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const socket = createConnection({ host: '127.0.0.1', port: info.port });
    let buffer = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new XdError(`${cmd}: no answer from session ${info.name} in ${timeout} ms`));
    }, timeout);
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      socket.write(`${JSON.stringify({ key: info.key, id, cmd, args })}\n`);
    });
    socket.on('data', (chunk) => {
      buffer += chunk;
      const end = buffer.indexOf('\n');
      if (end < 0) return;
      clearTimeout(timer);
      socket.end();
      const answer = JSON.parse(buffer.slice(0, end));
      if (answer.ok) resolve(answer.result);
      else reject(new XdError(answer.error ?? `${cmd} failed`));
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(new XdError(`Session ${info.name} is not answering (${error.code ?? error.message})`));
    });
  });
}
