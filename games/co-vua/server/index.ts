import type { GameServer } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { CoVuaGame } from './game/CoVuaGame.js';
import type { Options, State } from './game/model.js';

export default { manifest, game: new CoVuaGame() } satisfies GameServer<State, Options>;
