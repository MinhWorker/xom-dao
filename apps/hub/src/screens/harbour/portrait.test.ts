import { AVATARS, FRAMES } from '@xomdao/shared/client';
import { describe, expect, it } from 'vitest';
import { avatarSrc, frameSrc } from './portrait.js';

describe('portrait', () => {
  it('has a picture for every avatar and every frame', () => {
    for (const id of AVATARS) expect(avatarSrc(id)).toContain(`avatar-${id}`);
    for (const id of FRAMES) expect(frameSrc(id)).toContain(`frame-${id}`);
  });

  it('falls back to the default picture and frame for an id it does not know', () => {
    expect(avatarSrc('nobody')).toContain('avatar-harbour');
    expect(frameSrc('nothing')).toContain('frame-gold');
  });
});
