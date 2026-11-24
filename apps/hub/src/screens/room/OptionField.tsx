import type { ChoiceValue, RoomOption } from '@xomdao/sdk';
import { Choice, Toggle } from '../../kit/index.js';
import { choiceFromString, pickedChoice } from './options.js';

export interface OptionFieldProps {
  option: RoomOption;
  /** What is picked; an unknown value shows the option's default. */
  value: unknown;
  disabled?: boolean;
  onChange(value: ChoiceValue | boolean): void;
}

/** One option a manifest declares: a `choice` as a row of buttons, a `toggle` as a switch. */
export function OptionField({ option, value, disabled, onChange }: OptionFieldProps) {
  return option.type === 'choice' ? (
    <Choice
      label={option.label}
      options={option.choices.map((c) => ({ value: String(c.value), label: c.label }))}
      value={String(pickedChoice(option, value))}
      disabled={disabled}
      onChange={(raw) => onChange(choiceFromString(option, raw))}
    />
  ) : (
    <Toggle
      label={option.label}
      checked={typeof value === 'boolean' ? value : option.default}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
