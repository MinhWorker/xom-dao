import type { GameServer } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { CaroGame } from './game/CaroGame.js';
import type { Options, State } from './game/model.js';

export default { manifest, game: new CaroGame() } satisfies GameServer<State, Options>;
