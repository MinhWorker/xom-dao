import { Game, type StartContext } from '@xomdao/sdk';
import type { State } from './model.js';

/** Cờ Tỷ Phú: for now a Match that starts and has no moves. */
export class CoTyPhuGame extends Game<State> {
  readonly events = {};

  onStart(_ctx: StartContext): State {
    return { turn: 0 };
  }
}
