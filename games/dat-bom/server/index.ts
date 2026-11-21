import type { RealtimeGameServer } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { DatBomGame } from './game/DatBomGame.js';
import type { Input, Options, State } from './game/model.js';

export default { manifest, game: new DatBomGame() } satisfies RealtimeGameServer<
  State,
  Input,
  Options
>;
