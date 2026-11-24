import type { GameServer } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { CoTyPhuGame } from './game/CoTyPhuGame.js';
import type { Options, State } from './game/model.js';

export default { manifest, game: new CoTyPhuGame() } satisfies GameServer<State, Options>;
