import { RoomOptions } from '@xomdao/shared/client';
import { z } from 'zod';
import type { Harness } from './harness.js';
import { ServerError } from './link.js';

const player = z.int().min(0);

/**
 * What the CLI and the debug page can ask of a running Harness: each command's arguments (JSON,
 * checked here) and what it does. `reset`, `state` and `log` need none.
 */
const commands = {
  create: {
    args: z.object({ options: RoomOptions.optional(), headless: z.boolean().optional() }),
    run: (h: Harness, a: { options?: RoomOptions; headless?: boolean }) => h.create(a),
  },
  join: {
    args: z.object({ headless: z.boolean().optional() }),
    run: (h: Harness, a: { headless?: boolean }) => h.join(a),
  },
  bot: { args: z.object({}), run: (h: Harness) => h.bot() },
  'remove-bot': {
    args: z.object({ seat: z.int().min(0) }),
    run: (h: Harness, a: { seat: number }) => h.removeBot(a.seat),
  },
  options: {
    args: z.object({ options: RoomOptions }),
    run: (h: Harness, a: { options: RoomOptions }) => h.setOptions(a.options),
  },
  start: { args: z.object({}), run: (h: Harness) => h.start() },
  move: {
    args: z.object({ player, event: z.string().min(1), payload: z.unknown().optional() }),
    run: (h: Harness, a: { player: number; event: string; payload?: unknown }) =>
      h.move(a.player, a.event, a.payload),
  },
  init: {
    args: z.object({ player }),
    run: (h: Harness, a: { player: number }) => h.init(a.player),
  },
  reconnect: {
    args: z.object({ player }),
    run: (h: Harness, a: { player: number }) => h.reconnect(a.player),
  },
  disconnect: {
    args: z.object({ player }),
    run: (h: Harness, a: { player: number }) => h.disconnect(a.player),
  },
  leave: {
    args: z.object({ player }),
    run: (h: Harness, a: { player: number }) => h.leave(a.player),
  },
  visibility: {
    args: z.object({ player, hidden: z.boolean() }),
    run: (h: Harness, a: { player: number; hidden: boolean }) => h.visibility(a.player, a.hidden),
  },
  settings: {
    args: z.object({
      player,
      volume: z.number().min(0).max(1).optional(),
      muted: z.boolean().optional(),
      graphics: z.enum(['high', 'low']).optional(),
    }),
    run: (
      h: Harness,
      a: { player: number; volume?: number; muted?: boolean; graphics?: 'high' | 'low' },
    ) =>
      h.settings(a.player, {
        ...(a.volume !== undefined && { volume: a.volume }),
        ...(a.muted !== undefined && { muted: a.muted }),
        ...(a.graphics !== undefined && { graphics: a.graphics }),
      }),
  },
  net: {
    args: z.object({
      latency: z.number().min(0).max(10_000).optional(),
      drop: z.number().min(0).max(1).optional(),
    }),
    run: (h: Harness, a: { latency?: number; drop?: number }) => h.setNet(a),
  },
  reset: { args: z.object({}), run: (h: Harness) => h.reset() },
};

export const COMMANDS = Object.keys(commands);

/** Runs a command with JSON `args`; an unknown command or bad arguments throw a `ServerError`. */
export async function runCommand(harness: Harness, name: string, args: unknown) {
  if (!Object.hasOwn(commands, name)) throw new ServerError(`Unknown command "${name}"`);
  const command = commands[name as keyof typeof commands];
  const parsed = command.args.safeParse(args ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ServerError(`Bad arguments for ${name}: ${issue?.path.join('.')} ${issue?.message}`);
  }
  const run = command.run as (h: Harness, a: unknown) => Promise<unknown> | unknown;
  const result = await run(harness, parsed.data);
  return result ?? { ok: true };
}
