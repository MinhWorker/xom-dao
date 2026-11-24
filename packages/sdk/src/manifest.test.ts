import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  defineManifest,
  type ManifestOptions,
  type ManifestPreferences,
  optionsSchema,
  parseManifest,
  preferenceValues,
} from './manifest.js';

const base = {
  id: 'tien-len',
  name: 'Tiến Lên',
  tagline: 'Đánh hết bài trên tay trước mọi người.',
  minPlayers: 2,
  maxPlayers: 4,
  duration: { min: 5, max: 15 },
  status: 'wip',
  bots: true,
  island: 'co',
  focus: { x: 70, y: 45 },
} as const;

const manifest = defineManifest({
  ...base,
  options: {
    rounds: {
      type: 'choice',
      label: 'Số vòng',
      choices: [
        { value: 1, label: '1 vòng' },
        { value: 3, label: '3 vòng' },
        { value: 5, label: '5 vòng' },
      ],
      default: 3,
    },
    fast: { type: 'toggle', label: 'Đánh nhanh', default: false },
  },
});

describe('a Game manifest', () => {
  it('gives the room options’ types to the Game', () => {
    expectTypeOf<ManifestOptions<typeof manifest>>().toEqualTypeOf<{
      rounds: 1 | 3 | 5;
      fast: boolean;
    }>();
  });

  it('makes a schema that fills defaults and refuses unknown picks', () => {
    const schema = optionsSchema(manifest);
    expect(schema.parse({})).toEqual({ rounds: 3, fast: false });
    expect(schema.parse({ rounds: 5, fast: true })).toEqual({ rounds: 5, fast: true });
    expect(schema.safeParse({ rounds: 4 }).success).toBe(false);
    expect(schema.safeParse({ fast: 'yes' }).success).toBe(false);
  });

  it('has no options when it declares none', () => {
    const plain = defineManifest(base);
    expect(optionsSchema(plain).parse({})).toEqual({});
  });

  it('is checked by the type checker, and again when it loads', () => {
    // @ts-expect-error a status is wip or ready
    expect(() => defineManifest({ ...base, status: 'beta' })).toThrow('status');
    // @ts-expect-error the focus is needed to crop the key art
    expect(() => defineManifest({ ...base, focus: undefined })).toThrow('focus');
    expect(() =>
      // @ts-expect-error the default is one of the choices
      defineManifest({
        ...base,
        options: {
          rounds: {
            type: 'choice',
            label: 'Số vòng',
            choices: [
              { value: 1, label: '1 vòng' },
              { value: 3, label: '3 vòng' },
            ],
            default: 7,
          },
        },
      }),
    ).toThrow('default');
    expect(() =>
      // @ts-expect-error a toggle's default is a boolean
      defineManifest({
        ...base,
        options: { fast: { type: 'toggle', label: 'Nhanh', default: 1 } },
      }),
    ).toThrow('options.fast');
  });

  it('refuses what types can’t catch when it loads', () => {
    expect(() => defineManifest({ ...base, id: 'Tien Len' })).toThrow('id');
    expect(() => defineManifest({ ...base, minPlayers: 5 })).toThrow('maxPlayers');
    expect(() => defineManifest({ ...base, duration: { min: 20, max: 15 } })).toThrow('duration');
    expect(() => defineManifest({ ...base, focus: { x: 120, y: 50 } })).toThrow('focus');
    expect(() => defineManifest({ ...base, tagline: ' ' })).toThrow('tagline');
    // @ts-expect-error an Island is one of ISLANDS
    expect(() => defineManifest({ ...base, island: 'dao' })).toThrow('island');
    expect(() =>
      defineManifest({
        ...base,
        options: {
          rounds: {
            type: 'choice',
            label: 'Số vòng',
            choices: [
              { value: 1, label: '1 vòng' },
              { value: 1, label: 'Một vòng' },
            ],
            default: 1,
          },
        },
      }),
    ).toThrow('choices');
    expect(() =>
      defineManifest({
        ...base,
        options: { 'so-vong': { type: 'toggle', label: 'x', default: true } },
      }),
    ).toThrow('options');
  });
});

describe('player preferences', () => {
  const withPrefs = defineManifest({
    ...base,
    preferences: {
      follow: { type: 'toggle', label: 'Máy quay bám theo', default: true },
      size: {
        type: 'choice',
        label: 'Cỡ bài',
        choices: [
          { value: 'small', label: 'Nhỏ' },
          { value: 'big', label: 'Lớn' },
        ],
        default: 'small',
      },
    },
  });

  it('gives their types to the Game', () => {
    expectTypeOf<ManifestPreferences<typeof withPrefs>>().toEqualTypeOf<{
      follow: boolean;
      size: 'small' | 'big';
    }>();
  });

  it('fills what a player saved with the defaults, dropping what is not one of them', () => {
    expect(preferenceValues(withPrefs, undefined)).toEqual({ follow: true, size: 'small' });
    expect(preferenceValues(withPrefs, { follow: false, size: 'big' })).toEqual({
      follow: false,
      size: 'big',
    });
    expect(preferenceValues(withPrefs, { follow: 'no', size: 'huge', old: 1 })).toEqual({
      follow: true,
      size: 'small',
    });
    expect(preferenceValues(base as never, { follow: false })).toEqual({});
  });

  it('is checked like the Room options when it loads', () => {
    expect(() =>
      defineManifest({
        ...base,
        preferences: { 'bam-theo': { type: 'toggle', label: 'x', default: true } },
      }),
    ).toThrow('preferences');
  });
});

describe('a soon manifest', () => {
  const soon = {
    id: 'co-vua',
    name: 'Cờ Vua',
    tagline: 'Chiếu hết vua của đối phương.',
    island: 'co',
    status: 'soon',
  } as const;

  it('needs only what its locked card shows', () => {
    expect(defineManifest(soon)).toEqual(soon);
    expect(parseManifest(soon).success).toBe(true);
  });

  it('refuses what only a playable Game declares, and a missing Island', () => {
    // @ts-expect-error a soon Game has no players yet
    expect(() => defineManifest({ ...soon, minPlayers: 2 })).toThrow('minPlayers');
    // @ts-expect-error the Island is needed
    expect(() => defineManifest({ ...soon, island: undefined })).toThrow('island');
    expect(parseManifest({ ...base, island: undefined }).success).toBe(false);
  });
});
