/**
 * The Game manifest: what a Game declares, as static data, in `games/<id>/manifest.ts` so the
 * Hub can present it and the server can open Rooms for it.
 *
 *   export default defineManifest({
 *     id: 'tien-len', name: 'Tiến Lên', tagline: 'Đánh hết bài trên tay trước mọi người.',
 *     island: 'bai', minPlayers: 2, maxPlayers: 4, duration: { min: 5, max: 15 },
 *     status: 'wip', bots: true, focus: { x: 70, y: 45 },
 *     options: {
 *       rounds: { type: 'choice', label: 'Số vòng', default: 3,
 *                 choices: [{ value: 1, label: '1 vòng' }, { value: 3, label: '3 vòng' }] },
 *       fast: { type: 'toggle', label: 'Đánh nhanh', default: false },
 *     },
 *     preferences: { sorted: { type: 'toggle', label: 'Tự xếp bài', default: true } },
 *   });
 *
 * The type checker catches wrong fields and a default outside its choices; `defineManifest`
 * checks the rest against `GameManifestSchema` when it loads. The Game's options type is
 * `ManifestOptions<typeof manifest>`, and the server checks a Room's picks with `optionsSchema`.
 * `preferences` have the same shapes but belong to each player on their own device: the Hub shows
 * them in the waiting room and its settings, keeps them, and sends them to the Game's client as
 * the Bridge `settings.preferences` (`preferenceValues` fills the defaults). The server never sees
 * them.
 *
 * A Game not made yet declares only what its locked card shows, beside `hub/emblem.svg`:
 *
 *   export default defineManifest({
 *     id: 'co-vua', name: 'Cờ Vua', tagline: 'Chiếu hết vua của đối phương.',
 *     island: 'co', status: 'soon',
 *   });
 */
import { z } from 'zod';

/** A value a `choice` option can take. */
export type ChoiceValue = string | number;

/** Pick one of labelled values (e.g. the number of rounds). */
export interface ChoiceOption<V extends ChoiceValue = ChoiceValue> {
  type: 'choice';
  /** Vietnamese, shown in the waiting room. */
  label: string;
  choices: readonly { value: V; label: string }[];
  default: V;
}

/** On or off. */
export interface ToggleOption {
  type: 'toggle';
  /** Vietnamese, shown in the waiting room. */
  label: string;
  default: boolean;
}

/** A Room option the Hub draws in the waiting room. */
export type RoomOption = ChoiceOption | ToggleOption;

/** The Islands' ids; their names, order and Emblems are in `apps/hub`. */
export const ISLANDS = ['co', 'bai', 'xuc-xac', 'nao-nhiet'] as const;

/** The group of Games of one kind a Game belongs to. */
export type Island = (typeof ISLANDS)[number];

/** What a Game declares to the Hub and the server. */
export interface GameManifest<
  O extends Record<string, RoomOption> = Record<string, RoomOption>,
  P extends Record<string, RoomOption> = Record<string, RoomOption>,
> {
  /** The Game's folder name, `games/<id>/`: kebab-case. */
  id: string;
  /** Vietnamese only. */
  name: string;
  /** One Vietnamese sentence for its card. */
  tagline: string;
  island: Island;
  minPlayers: number;
  maxPlayers: number;
  /** How many minutes a Match usually takes. */
  duration: { min: number; max: number };
  /** `wip` shows only in dev and PR previews; `ready` also in production; `soon` is a `SoonManifest`. */
  status: 'wip' | 'ready';
  /** Whether the computer can take seats (the Game has a `bot` hook). */
  bots: boolean;
  /** The subject of `hub/key-art.png`, in % of its width and height: crops centre on it. */
  focus: { x: number; y: number };
  /** Room options; their keys are what the Game reads in `ctx.options`. */
  options?: O;
  /** Each player's own choices for the Game's client, like a camera that follows the moves. */
  preferences?: P;
}

/** A Game not made yet: only `manifest.ts` and `hub/emblem.svg`, which the build skips. */
export interface SoonManifest {
  id: string;
  name: string;
  tagline: string;
  island: Island;
  status: 'soon';
}

/** Any `games/<id>/manifest.ts`. */
export type AnyManifest = GameManifest | SoonManifest;

/** The options' values as the Game reads them in `ctx.options`. */
export type ManifestOptions<M extends GameManifest> =
  M extends GameManifest<infer O>
    ? { -readonly [K in keyof O]: O[K] extends ChoiceOption<infer V> ? V : boolean }
    : never;

/** The preferences' values as the Game's client reads them from the Bridge. */
export type ManifestPreferences<M extends GameManifest> =
  M extends GameManifest<Record<string, RoomOption>, infer P>
    ? { -readonly [K in keyof P]: P[K] extends ChoiceOption<infer V> ? V : boolean }
    : never;

/** Infers the options from what is written and refuses a `choice` default outside its values. */
type CheckedOptions<O> = {
  [K in keyof O]: O[K] extends { type: 'choice'; choices: readonly { value: infer V }[] }
    ? Omit<O[K], 'default'> & { default: V }
    : O[K];
};

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const OPTION_KEY = /^[a-z][a-zA-Z0-9]*$/;
const text = z.string().trim().min(1);
const percent = z.number().min(0).max(100);

const choiceOption = z
  .object({
    type: z.literal('choice'),
    label: text,
    choices: z.array(z.object({ value: z.union([z.string(), z.number()]), label: text })).min(2),
    default: z.union([z.string(), z.number()]),
  })
  .refine((o) => new Set(o.choices.map((c) => c.value)).size === o.choices.length, {
    message: 'choices must have different values',
    path: ['choices'],
  })
  .refine((o) => o.choices.some((c) => c.value === o.default), {
    message: 'default must be one of the choices',
    path: ['default'],
  });

const toggleOption = z.object({ type: z.literal('toggle'), label: text, default: z.boolean() });

const identity = {
  id: z.string().regex(KEBAB, 'id must be kebab-case, like the folder name'),
  name: text,
  tagline: text,
  island: z.enum(ISLANDS),
};

/** The checks of a `soon` manifest at runtime. */
export const SoonManifestSchema = z.object({ ...identity, status: z.literal('soon') }).strict();

/** The manifest's checks at runtime: what `defineManifest` runs and the Hub's build reuses. */
export const GameManifestSchema = z
  .object({
    ...identity,
    minPlayers: z.int().min(1),
    maxPlayers: z.int().min(1),
    duration: z.object({ min: z.number().positive(), max: z.number().positive() }),
    status: z.enum(['wip', 'ready']),
    bots: z.boolean(),
    focus: z.object({ x: percent, y: percent }),
    options: z
      .record(
        z.string().regex(OPTION_KEY, 'options keys are camelCase'),
        z.discriminatedUnion('type', [choiceOption, toggleOption]),
      )
      .optional(),
    preferences: z
      .record(
        z.string().regex(OPTION_KEY, 'preferences keys are camelCase'),
        z.discriminatedUnion('type', [choiceOption, toggleOption]),
      )
      .optional(),
  })
  .strict()
  .refine((m) => m.minPlayers <= m.maxPlayers, {
    message: 'maxPlayers must be at least minPlayers',
    path: ['maxPlayers'],
  })
  .refine((m) => m.duration.min <= m.duration.max, {
    message: 'duration.min must not be above duration.max',
    path: ['duration'],
  });

/** Checks any manifest against the schema its `status` calls for. */
export function parseManifest(manifest: unknown) {
  const soon = (manifest as { status?: unknown } | null)?.status === 'soon';
  return soon ? SoonManifestSchema.safeParse(manifest) : GameManifestSchema.safeParse(manifest);
}

/**
 * Declares a Game manifest: `export default defineManifest({ … })`. Throws, naming the field,
 * when it breaks a rule the type checker can't see (a min above its max, a focus off the art).
 */
export function defineManifest(manifest: SoonManifest): SoonManifest;
export function defineManifest<
  const O extends Record<string, RoomOption> = Record<never, never>,
  const P extends Record<string, RoomOption> = Record<never, never>,
>(
  manifest: Omit<GameManifest, 'options' | 'preferences'> & {
    options?: CheckedOptions<O>;
    preferences?: CheckedOptions<P>;
  },
): GameManifest<O, P>;
export function defineManifest(manifest: AnyManifest): AnyManifest {
  const parsed = parseManifest(manifest);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Game manifest "${manifest.id}": ${problems.join('; ')}`);
  }
  return manifest;
}

/** Checks a Room's picks against the manifest's options and fills the defaults. */
export function optionsSchema<M extends GameManifest>(manifest: M): z.ZodType<ManifestOptions<M>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, option] of Object.entries(manifest.options ?? {})) {
    shape[key] =
      option.type === 'toggle'
        ? z.boolean().default(option.default)
        : z
            .union([z.string(), z.number()])
            .refine((v) => option.choices.some((c) => c.value === v), 'Lựa chọn không hợp lệ')
            .default(option.default);
  }
  return z.object(shape).strict() as unknown as z.ZodType<ManifestOptions<M>>;
}

/** A player's preferences for a Game: what they saved where it is valid, the defaults elsewhere. */
export function preferenceValues(
  manifest: Pick<GameManifest, 'preferences'>,
  saved: unknown,
): Record<string, ChoiceValue | boolean> {
  const picks = (typeof saved === 'object' && saved !== null ? saved : {}) as Record<
    string,
    unknown
  >;
  const out: Record<string, ChoiceValue | boolean> = {};
  for (const [key, pref] of Object.entries(manifest.preferences ?? {})) {
    const value = picks[key];
    const valid =
      pref.type === 'toggle'
        ? typeof value === 'boolean'
        : pref.choices.some((c) => c.value === value);
    out[key] = valid ? (value as ChoiceValue | boolean) : pref.default;
  }
  return out;
}
