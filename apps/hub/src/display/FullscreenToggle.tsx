import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import { Icon } from '../kit/index.js';
import { playSound } from '../sound/index.js';
import styles from './FullscreenToggle.module.css';
import {
  canFullscreen,
  displayEnv,
  enterFullscreen,
  exitFullscreen,
  useFullscreen,
} from './fullscreen.js';

/** Enters or leaves fullscreen; absent where the browser cannot (iPhone) or the app is installed. */
export function FullscreenToggle() {
  const active = useFullscreen();
  if (!active && !canFullscreen(displayEnv())) return null;
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={active}
      aria-label="Toàn màn hình"
      onClick={() => {
        playSound('click');
        void (active ? exitFullscreen() : enterFullscreen());
      }}
    >
      <Icon icon={active ? IconArrowsMinimize : IconArrowsMaximize} />
    </button>
  );
}
