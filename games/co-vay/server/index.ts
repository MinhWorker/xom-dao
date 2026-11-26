import type { GameServer } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { CoVayGame } from './game/CoVayGame.js';
import type { Options, State } from './game/model.js';

export default { manifest, game: new CoVayGame() } satisfies GameServer<State, Options>;
