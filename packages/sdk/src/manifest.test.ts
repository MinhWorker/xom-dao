import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineManifest, type ManifestOptions, optionsSchema } from './manifest.js';

const base = {
  id: 'tien-len',
  name: 'Tiến Lên',
  tagline: 'Đánh hết bài trên tay trước mọi người.',
  minPlayers: 2,
  maxPlayers: 4,
  duration: { min: 5, max: 15 },
  status: 'wip',
  bots: true,
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
            // @ts-expect-error the default is one of the choices
            default: 7,
          },
        },
      }),
    ).toThrow('default');
    expect(() =>
      defineManifest({
        ...base,
        // @ts-expect-error a toggle's default is a boolean
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
