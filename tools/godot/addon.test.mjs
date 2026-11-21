// The addon is GDScript, so Godot is not needed here: these only keep it in step with the Bridge
// in packages/bridge (the behaviour itself is checked by `npm run godot:verify`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BRIDGE_RESET,
  BRIDGE_TAG,
  BRIDGE_UNAVAILABLE,
  BRIDGE_VERSION,
  GameToHub,
  HubToGame,
} from '@xomdao/bridge';
import { describe, expect, it } from 'vitest';

const bridge = readFileSync(join(import.meta.dirname, 'addons/xomdao_bridge/bridge.gd'), 'utf8');
const constant = (name) => bridge.match(new RegExp(`^const ${name} := (.+)$`, 'm'))?.[1];
const typesOf = (union) => union.options.map((option) => option.shape.type.value);

describe('the Godot addon', () => {
  it('speaks the same Bridge version and constants', () => {
    expect(constant('BRIDGE_VERSION')).toBe(String(BRIDGE_VERSION));
    expect(constant('BRIDGE_TAG')).toBe(`"${BRIDGE_TAG}"`);
    expect(constant('ERROR_RESET')).toBe(`"${BRIDGE_RESET}"`);
    expect(constant('ERROR_UNAVAILABLE')).toBe(`"${BRIDGE_UNAVAILABLE}"`);
  });

  it('handles every message the Hub sends', () => {
    for (const type of typesOf(HubToGame)) expect(bridge).toContain(`"${type}":`);
  });

  it('sends every message the Game may send', () => {
    for (const type of typesOf(GameToHub)) expect(bridge).toContain(`"type": "${type}"`);
  });
});
