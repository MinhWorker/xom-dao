import type { GameManifest } from '@xomdao/sdk';
import type { RoomOptions as Picks } from '@xomdao/shared/client';
import { CutPanel } from '../../kit/index.js';
import { preferences, usePreferences } from '../../settings/preferences.js';
import { OptionField } from './OptionField.js';
import { withPick } from './options.js';
import styles from './RoomOptions.module.css';

export interface RoomOptionsProps {
  manifest: GameManifest;
  picks: Picks;
  /** Only the host changes the options. */
  editable: boolean;
  onChange(options: Picks): void;
}

/** The Room's options, drawn from the Game manifest. */
export function RoomOptions({ manifest, picks, editable, onChange }: RoomOptionsProps) {
  const entries = Object.entries(manifest.options ?? {});
  if (entries.length === 0) return null;

  return (
    <CutPanel label="Tuỳ chọn phòng" className={styles.panel}>
      <div className={styles.list}>
        {entries.map(([key, option]) => (
          <OptionField
            key={key}
            option={option}
            value={picks[key]}
            disabled={!editable}
            onChange={(value) => onChange(withPick(picks, key, value))}
          />
        ))}
      </div>
    </CutPanel>
  );
}

/** The player's own preferences for the Game, drawn from its manifest; `null` when it has none. */
export function PreferenceFields({ manifest }: { manifest: GameManifest }) {
  const values = usePreferences(manifest);
  const entries = Object.entries(manifest.preferences ?? {});
  if (entries.length === 0) return null;
  return (
    <div className={styles.list}>
      {entries.map(([key, option]) => (
        <OptionField
          key={key}
          option={option}
          value={values[key]}
          onChange={(value) => preferences.set(manifest.id, key, value)}
        />
      ))}
    </div>
  );
}

/** The player's own preferences in the waiting room. */
export function MyPreferences({ manifest }: { manifest: GameManifest }) {
  if (Object.keys(manifest.preferences ?? {}).length === 0) return null;
  return (
    <CutPanel label="Tuỳ chọn của bạn" className={styles.panel}>
      <PreferenceFields manifest={manifest} />
    </CutPanel>
  );
}
