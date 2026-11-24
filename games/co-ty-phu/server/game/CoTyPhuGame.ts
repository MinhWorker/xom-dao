import { Game } from '@xomdao/sdk';
import type { State } from './model.js';

/** Cờ Tỷ Phú's rules. */
export class CoTyPhuGame extends Game<State> {
  readonly events = {};

  onStart(): State {
    return { turn: 0 };
  }
}
