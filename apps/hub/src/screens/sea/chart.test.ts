import type { GameManifest, SoonManifest } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import type { HubGame } from '../../games.js';
import { islandCards } from './chart.js';

const game = (id: string, name: string, island: GameManifest['island']): HubGame => ({
  manifest: {
    id,
    name,
    tagline: '',
    island,
    status: 'ready',
    minPlayers: 2,
    maxPlayers: 2,
    duration: { min: 5, max: 5 },
  } as GameManifest,
  emblem: `<svg id="${id}"/>`,
  art: { lobby: `/games/${id}/lobby.webp`, card: `/games/${id}/card.webp`, thumb: '' },
  rules: [],
  version: '1',
});

const soon = (id: string, name: string, island: SoonManifest['island']) => ({
  manifest: { id, name, tagline: '', island, status: 'soon' } as SoonManifest,
  emblem: `<svg id="${id}"/>`,
});

describe('islandCards', () => {
  const games = [game('caro', 'Caro', 'co'), game('tien-len', 'Tiến Lên', 'bai')];
  const later = [soon('co-vua', 'Cờ Vua', 'co'), soon('co-dam', 'Cờ Đam', 'co')];

  it('lists an Island’s made Games first, then the ones to come, each by name', () => {
    const cards = islandCards('co', games, later, '/co.png');
    expect(cards.map((c) => c.id)).toEqual(['caro', 'co-dam', 'co-vua']);
  });

  it('gives a made Game its own art and a Game to come the Island’s art', () => {
    const [caro, coDam] = islandCards('co', games, later, '/co.png');
    expect(caro).toMatchObject({
      name: 'Caro',
      game: games[0],
      splash: '/games/caro/lobby.webp',
      picture: '/games/caro/card.webp',
      emblem: '<svg id="caro"/>',
    });
    expect(coDam).toMatchObject({ name: 'Cờ Đam', splash: '/co.png' });
    expect(coDam?.game).toBeUndefined();
    expect(coDam?.picture).toBeUndefined();
  });

  it('leaves out other Islands', () => {
    expect(islandCards('bai', games, later, '/bai.png').map((c) => c.id)).toEqual(['tien-len']);
    expect(islandCards('xuc-xac', games, later, '/xx.png')).toEqual([]);
  });
});
