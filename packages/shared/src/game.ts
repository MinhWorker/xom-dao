import type { AnyGamePlugin, GameMeta } from '@xomdao/sdk/legacy';

// The game contract lives in @xomdao/sdk (games only depend on the SDK); core code imports it
// from here.
export type { GameMeta, GameResult, GameRules, PlayerId } from '@xomdao/sdk/legacy';
export { defaultOptions } from '@xomdao/sdk/legacy';

/**
 * A registered game as the server and web use it: its rules, its meta and its room options
 * (`room`, when it has any) in one object.
 */
export type AnyGameDefinition = AnyGamePlugin['rules'] & GameMeta & Pick<AnyGamePlugin, 'room'>;
