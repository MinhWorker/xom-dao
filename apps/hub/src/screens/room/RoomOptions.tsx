import type { GameManifest } from '@xomdao/sdk';
import type { RoomOptions as Picks } from '@xomdao/shared/client';
import { Choice, CutPanel, Toggle } from '../../kit/index.js';
import { choiceFromString, pickedChoice, withPick } from './options.js';
import styles from './RoomOptions.module.css';

export interface RoomOptionsProps {
  manifest: GameManifest;
  picks: Picks;
  /** Only the host changes the options. */
  editable: boolean;
  onChange(options: Picks): void;
}

/** The Room's options, drawn from the Game manifest: a `choice` as a row of buttons, a `toggle` as a switch. */
export function RoomOptions({ manifest, picks, editable, onChange }: RoomOptionsProps) {
  const entries = Object.entries(manifest.options ?? {});
  if (entries.length === 0) return null;

  return (
    <CutPanel label="Tuỳ chọn phòng" className={styles.panel}>
      <div className={styles.list}>
        {entries.map(([key, option]) =>
          option.type === 'choice' ? (
            <Choice
              key={key}
              label={option.label}
              options={option.choices.map((c) => ({ value: String(c.value), label: c.label }))}
              value={String(pickedChoice(option, picks[key]))}
              disabled={!editable}
              onChange={(raw) => onChange(withPick(picks, key, choiceFromString(option, raw)))}
            />
          ) : (
            <Toggle
              key={key}
              label={option.label}
              checked={typeof picks[key] === 'boolean' ? picks[key] : option.default}
              disabled={!editable}
              onChange={(checked) => onChange(withPick(picks, key, checked))}
            />
          ),
        )}
      </div>
    </CutPanel>
  );
}
