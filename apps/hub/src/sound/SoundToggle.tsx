import { IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { Icon } from '../kit/index.js';
import { sounds, useMuted } from './index.js';
import styles from './SoundToggle.module.css';

/** The mute button: an icon that shows whether the Hub's sound (and the Game's) is on. */
export function SoundToggle({ className }: { className?: string }) {
  const muted = useMuted();
  return (
    <button
      type="button"
      className={[styles.toggle, className].filter(Boolean).join(' ')}
      aria-pressed={muted}
      aria-label="Tắt tiếng"
      onClick={() => sounds.setMuted(!muted)}
    >
      <Icon icon={muted ? IconVolumeOff : IconVolume} />
    </button>
  );
}
