import type { GameServer } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { CoTuongGame } from './game/CoTuongGame.js';
import type { Options, State } from './game/model.js';

export default { manifest, game: new CoTuongGame() } satisfies GameServer<State, Options>;
