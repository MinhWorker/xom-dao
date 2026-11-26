import type { GameServer } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { HaiChienGame } from './game/HaiChienGame.js';
import type { Options, State, View } from './game/model.js';

export default { manifest, game: new HaiChienGame() } satisfies GameServer<State, Options, View>;
