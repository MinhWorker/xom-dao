#!/usr/bin/env node
// xd: drive the Godot client from the command line, like Playwright for Godot. See HELP below
// and tools/xd/README.md. Sessions are desktop debug clients with a control channel
// (apps/client/core/xd_server.gd); state lives in .xd/.
import { isAbsolute, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { root } from '../godot/lib.mjs';
import {
  account,
  call,
  importResources,
  launch,
  readSession,
  serverInfo,
  serverUrl,
  sessionLog,
  sessions,
  startServer,
  stopServer,
  stopSession,
  tail,
  updateSession,
  XdError,
} from './lib.mjs';

const HELP = `xd: drive the Godot client from the command line.

  npm run -s xd -- <command> [args] [-s <session>] [--json]

Server and sessions
  server start [--port N] [--bot-delay MS]   dev server: dev commands on, accounts in memory
  server stop | status
  start [session] [--as <account>] [--size WxH|16:9|20:9] [--play <game>] [--room <code>]
        [--server <url>] [--visible] [--import]
                         start a client logged in as <account> (default: the session name)
  stop [session] | --all
  restart [session] [--import]   relaunch with the same login; it goes back to its seat
  ls                     sessions and accounts
  logs [session] [-n 60] [--errors]
  account <name>         make or log in an xd account; prints its token

Looking
  shot [node] [--out file.png] [--pad N] [--scale K]   PNG of the window or one node
  tree [node] [--depth N] [--rects]                   visible nodes (indented text)
  find <node>            path, type, text, box, disabled
  text <node>
  state [path]           scene, user, room snapshot, balances; a dotted path picks a part
  ping

Acting
  tap <node> | tap <x> <y>        real mouse click
  click <node>                    emit the button's pressed
  swipe <from> <to> [--ms 300]    node names or x,y
  type <node> <text> [--submit]
  key <key>                       Escape, Enter, Left, A…
  go <place> [arg]                lobby, select [genre], ben [game], nha, cho, dinh,
                                  play <game> (sandbox), rules [game]
  room create <game> [--options JSON] | quick <game> | join <code> [--watch]
       | ready [--off] | start | leave | sit | options <JSON>
  send <event> [JSON]             a game move, through the real rules
  request <event> [JSON]          any socket request
  dev <console line>              the room's dev console: state set, snapshot, seed, as, finish…
  coins <amount>                  dev:coins
  login <account>                 switch this session to another account
  size <WxH|16:9|18:9|19.5:9|20:9>

Waiting and scripting
  wait [--scene S] [--node N] [--gone N] [--text NODE=PART] [--expr GDSCRIPT] [--timeout MS]
  eval <GDScript expression>      names: hub, client, root, bridge; find("Name"), node("Name")

A node is a name ("Play") or a path of names ("Board/Cell_1_2"). Points are window pixels.
Session: -s <name>, else XD_SESSION, else "main".`;

const FRAMES = { '16:9': '1280x720', '18:9': '1440x720', '19.5:9': '1560x720', '20:9': '1600x720' };

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    session: { type: 'string', short: 's' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    as: { type: 'string' },
    size: { type: 'string' },
    play: { type: 'string' },
    room: { type: 'string' },
    server: { type: 'string' },
    visible: { type: 'boolean' },
    import: { type: 'boolean' },
    all: { type: 'boolean' },
    port: { type: 'string' },
    'bot-delay': { type: 'string' },
    out: { type: 'string' },
    pad: { type: 'string' },
    scale: { type: 'string' },
    depth: { type: 'string' },
    rects: { type: 'boolean' },
    ms: { type: 'string' },
    submit: { type: 'boolean' },
    options: { type: 'string' },
    watch: { type: 'boolean' },
    off: { type: 'boolean' },
    scene: { type: 'string' },
    node: { type: 'string' },
    gone: { type: 'string' },
    text: { type: 'string' },
    expr: { type: 'string' },
    timeout: { type: 'string' },
    n: { type: 'string', short: 'n' },
    errors: { type: 'boolean' },
  },
});

const [command, ...rest] = positionals;

function sessionName(fromPositional) {
  return fromPositional ?? flags.session ?? process.env.XD_SESSION ?? 'main';
}

function running(name = sessionName()) {
  const info = readSession(name);
  if (!info?.running) {
    throw new XdError(
      `Session ${name} is not running. Start it with: npm run -s xd -- start ${name}`,
    );
  }
  return info;
}

function json(text, what) {
  if (text === undefined) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new XdError(`${what} is not JSON: ${text}`);
  }
}

function frameSize(value) {
  const size = FRAMES[value] ?? value;
  if (!/^\d+x\d+$/.test(size)) throw new XdError(`Size must be WxH or 16:9, 18:9, 19.5:9, 20:9`);
  return size;
}

function pick(value, path) {
  if (!path) return value;
  return path.split('.').reduce((at, key) => (at == null ? undefined : at[key]), value);
}

function show(value) {
  if (flags.json) return console.log(JSON.stringify(value));
  if (value === undefined || value === true) return;
  if (typeof value === 'string') return console.log(value);
  console.log(JSON.stringify(value, null, 2));
}

/** The tree as indented lines: Name Type "text" @x,y wxh (disabled). */
function printTree(node, depth = 0, lines = []) {
  const parts = [`${'  '.repeat(depth)}${node.name}`, node.type];
  if (node.text !== undefined) parts.push(JSON.stringify(String(node.text)).slice(0, 80));
  if (Array.isArray(node.rect)) {
    const [x, y, w, h] = node.rect.map(Math.round);
    parts.push(`@${x},${y} ${w}x${h}`);
  }
  if (node.disabled) parts.push('(disabled)');
  lines.push(parts.join(' '));
  for (const child of node.children ?? []) printTree(child, depth + 1, lines);
  return lines;
}

function point(text) {
  const match = /^(-?[\d.]+),(-?[\d.]+)$/.exec(text ?? '');
  return match ? [Number(match[1]), Number(match[2])] : text;
}

function outPath(name) {
  const path = flags.out ?? `.shots/xd-${name}.png`;
  return isAbsolute(path) ? path : resolve(root, path);
}

const shortPath = (path) => (path.startsWith(root) ? relative(root, path) : path);

async function act(cmd, args, timeout) {
  return call(running(), cmd, args, timeout);
}

const commands = {
  async server() {
    const [action = 'status'] = rest;
    if (action === 'start') {
      const info = await startServer({
        port: flags.port && Number(flags.port),
        botDelay: flags['bot-delay'] && Number(flags['bot-delay']),
      });
      return show(flags.json ? info : `${info.already ? 'Already up' : 'Up'}: ${info.url}`);
    }
    if (action === 'stop') {
      const info = await stopServer();
      return show(info ? `Stopped ${info.url}` : 'No xd server');
    }
    const info = serverInfo();
    return show(flags.json ? info : info ? `${info.url} (pid ${info.pid})` : 'No xd server');
  },

  async start() {
    const name = sessionName(rest[0]);
    const server = await serverUrl(flags.server);
    if (flags.import) importResources();
    const args = [];
    if (flags.play) args.push(`--play=${flags.play}`);
    if (flags.room) args.push(`--room=${flags.room}`);
    const started = Date.now();
    const info = await launch({
      name,
      as: flags.as ?? name,
      server,
      size: frameSize(flags.size ?? '1280x720'),
      visible: flags.visible,
      args,
    });
    if (flags.play)
      await call(info, 'wait', { expr: 'bridge.scene == client.snapshot.game_id' }, 60_000).catch(
        () => {},
      );
    const ping = await call(info, 'ping');
    show(
      flags.json
        ? { ...info, ...ping, key: undefined }
        : `${name} up in ${((Date.now() - started) / 1000).toFixed(1)}s as ${info.username} ` +
            `on ${server}, scene ${ping.scene}${info.hidden ? ' (xvfb)' : ''}`,
    );
  },

  async stop() {
    const names = flags.all ? sessions().map((s) => s.name) : [sessionName(rest[0])];
    for (const name of names) {
      const info = await stopSession(name);
      show(info ? `Stopped ${name}` : `No session ${name}`);
    }
  },

  async restart() {
    const name = sessionName(rest[0]);
    const info = readSession(name);
    if (!info) throw new XdError(`No session ${name}`);
    await stopSession(name);
    if (flags.import) importResources();
    const started = Date.now();
    const again = await launch({
      name,
      as: info.as,
      server: info.server,
      size: info.size,
      visible: !info.hidden,
    });
    const ping = await call(again, 'ping');
    show(
      `${name} back in ${((Date.now() - started) / 1000).toFixed(1)}s, scene ${ping.scene}` +
        (ping.room ? `, room ${ping.room}` : ''),
    );
  },

  async ls() {
    const list = sessions();
    const own = serverInfo();
    if (flags.json) return show({ server: own, sessions: list.map(({ key, ...s }) => s) });
    console.log(own ? `server  ${own.url} (pid ${own.pid})` : 'server  none of xd’s own');
    if (list.length === 0) console.log('no sessions');
    for (const s of list) {
      let where = '';
      if (s.running) {
        const ping = await call(s, 'ping', {}, 2000).catch(() => null);
        where = ping ? `${ping.scene}${ping.room ? ` room ${ping.room}` : ''}` : 'not answering';
      }
      console.log(
        `${s.name.padEnd(8)} ${s.running ? 'up  ' : 'down'} ${s.username.padEnd(14)} ${s.size} ${where}`,
      );
    }
  },

  async logs() {
    const name = sessionName(rest[0]);
    let text = tail(sessionLog(name), Number(flags.n ?? 60) * (flags.errors ? 20 : 1));
    if (flags.errors) {
      const lines = text.split('\n');
      text = lines
        .filter(
          (line, i) =>
            /ERROR|SCRIPT ERROR|WARNING|error/i.test(line) ||
            (/^\s+at:/.test(line) && /ERROR/.test(lines[i - 1] ?? '')),
        )
        .slice(-Number(flags.n ?? 60))
        .join('\n');
    }
    console.log(text || '(empty)');
  },

  async account() {
    const [name] = rest;
    if (!name) throw new XdError('account needs a name');
    const server = await serverUrl(flags.server);
    const made = await account(server, name);
    show(flags.json ? made : `${made.username} (${made.name}) on ${server}\ntoken ${made.token}`);
  },

  async ping() {
    show(await act('ping'));
  },

  async shot() {
    const name = sessionName();
    const result = await act('shot', {
      path: outPath(name),
      node: rest[0],
      pad: flags.pad && Number(flags.pad),
      scale: flags.scale && Number(flags.scale),
    });
    show(flags.json ? result : `${shortPath(result.path)} ${result.width}x${result.height}`);
  },

  async tree() {
    const result = await act('tree', {
      node: rest[0],
      depth: flags.depth ? Number(flags.depth) : 99,
      rects: flags.rects,
    });
    if (flags.json) return show(result);
    console.log(printTree(result).join('\n'));
  },

  async find() {
    show((await act('find', { node: rest[0] })) ?? 'null');
  },

  async text() {
    show(await act('text', { node: rest[0] }));
  },

  async state() {
    show(pick(await act('state'), rest[0]) ?? 'null');
  },

  async tap() {
    const [a, b] = rest;
    const args = b !== undefined ? { x: Number(a), y: Number(b) } : { node: a };
    const at = await act('tap', args);
    if (flags.json) show(at);
  },

  async click() {
    await act('click', { node: rest[0] });
  },

  async swipe() {
    const [from, to] = rest;
    await act('swipe', { from: point(from), to: point(to), ms: flags.ms && Number(flags.ms) });
  },

  async type() {
    const [node, ...words] = rest;
    await act('type', { node, text: words.join(' '), submit: flags.submit });
  },

  async key() {
    await act('key', { key: rest[0] });
  },

  async go() {
    const [place, arg = ''] = rest;
    const scene = await act('go', { place, arg }, 60_000);
    if (place === 'play') {
      await act(
        'wait',
        { expr: 'bridge.scene == client.snapshot.game_id', timeout: 30_000 },
        40_000,
      );
      return show((await act('ping')).scene);
    }
    show(scene);
  },

  async room() {
    const [action, value] = rest;
    const args = { action };
    if (['create', 'quick'].includes(action)) args.game = value;
    if (action === 'create' && flags.options) args.options = json(flags.options, '--options');
    if (action === 'join') {
      args.code = value;
      if (flags.watch) args.role = 'spectator';
    }
    if (action === 'ready') args.ready = !flags.off;
    if (action === 'options') args.options = json(value, 'options');
    const result = await act('room', args, 60_000);
    show(flags.json ? result : result.code ? `room ${result.code}, scene ${result.scene}` : 'left');
  },

  async send() {
    const [event, payload] = rest;
    await act('send', { event, payload: json(payload, 'payload') });
  },

  async request() {
    const [event, data] = rest;
    show(await act('request', { event, data: json(data, 'data') }));
  },

  async dev() {
    const line = rest.join(' ');
    const reply = await act('request', { event: 'dev:command', data: { line } });
    if (reply.ok === false) throw new XdError(reply.error ?? 'dev command failed');
    show(flags.json ? reply : (reply.output ?? ''));
  },

  async coins() {
    const reply = await act('request', {
      event: 'dev:coins',
      data: { amount: Number(rest[0] ?? 1000) },
    });
    if (reply.ok === false) throw new XdError(reply.error ?? 'dev:coins failed');
    show(flags.json ? reply : `coins ${reply.balances?.['core:coin'] ?? '?'}`);
  },

  async login() {
    const [name] = rest;
    if (!name) throw new XdError('login needs an account name');
    const info = running();
    const made = await account(info.server, name);
    const result = await call(info, 'login', { token: made.token }, 60_000);
    updateSession(info.name, { as: name, username: made.username });
    show(flags.json ? result : `${sessionName()} is now ${made.username}, scene ${result.scene}`);
  },

  async size() {
    const [width, height] = frameSize(rest[0]).split('x').map(Number);
    const result = await act('size', { width, height });
    show(
      flags.json ? result : `window ${result.window.join('x')}, frame ${result.frame.join('x')}`,
    );
  },

  async wait() {
    const args = {};
    for (const key of ['scene', 'node', 'gone', 'expr']) if (flags[key]) args[key] = flags[key];
    if (flags.text) {
      const at = flags.text.indexOf('=');
      if (at < 0) throw new XdError('--text takes NODE=PART');
      args.text = [flags.text.slice(0, at), flags.text.slice(at + 1)];
    }
    const timeout = Number(flags.timeout ?? 10_000);
    args.timeout = timeout;
    const result = await act('wait', args, timeout + 5000);
    show(flags.json ? result : `ok after ${result.ms} ms, scene ${result.scene}`);
  },

  async eval() {
    show(await act('eval', { expr: rest.join(' ') }));
  },

  async help() {
    console.log(HELP);
  },
};

async function main() {
  if (flags.help || !command) return console.log(HELP);
  const run = commands[command];
  if (!run) throw new XdError(`Unknown command ${command}. Run: npm run -s xd -- help`);
  await run();
}

main().catch((error) => {
  console.error(`xd: ${error instanceof XdError ? error.message : (error.stack ?? error)}`);
  process.exit(1);
});
