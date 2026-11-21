import type { ChoiceOption, ChoiceValue } from '@xomdao/sdk';
import type { RoomOptions } from '@xomdao/shared/client';

/** The value a Room has picked for a `choice`, or the option's default when the pick is not one of its values. */
export function pickedChoice(option: ChoiceOption, picked: unknown): ChoiceValue {
  const known = option.choices.some((choice) => choice.value === picked);
  return known ? (picked as ChoiceValue) : option.default;
}

/** The choice whose value is written as `raw`: the kit's `Choice` handles strings, manifests may use numbers. */
export function choiceFromString(option: ChoiceOption, raw: string): ChoiceValue {
  return option.choices.find((choice) => String(choice.value) === raw)?.value ?? option.default;
}

/** The Room's options with one pick replaced, ready for `room:options`. */
export function withPick(
  options: RoomOptions,
  key: string,
  value: ChoiceValue | boolean,
): RoomOptions {
  return { ...options, [key]: value };
}
