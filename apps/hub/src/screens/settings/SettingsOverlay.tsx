import { IconX } from '@tabler/icons-react';
import type { GameManifest } from '@xomdao/sdk';
import { useId } from 'react';
import { GAMES } from '../../games.js';
import { Button, Chip, Choice, Icon, Select, Slider, Tabs, Toggle } from '../../kit/index.js';
import { useModal } from '../../kit/modal.js';
import { hub, useHub } from '../../net/hub.js';
import { FRAMES, isFrameId } from '../../settings/frame.js';
import {
  canScaleHud,
  type GraphicsLevel,
  graphics,
  HUD_SCALE,
  MARGIN,
  useGraphics,
} from '../../settings/graphics.js';
import { playSound, sounds, useEffects, useMusic, useMuted, useVolume } from '../../sound/index.js';
import { PreferenceFields } from '../room/RoomOptions.js';
import styles from './SettingsOverlay.module.css';

const percent = (value: number) => `${value}%`;

const LEVELS: { value: GraphicsLevel; label: string }[] = [
  { value: 'high', label: 'Cao' },
  { value: 'low', label: 'Thấp' },
];

const MARGIN_NAMES = ['Không', 'Vừa', 'Rộng'];
const marginName = (value: number) =>
  MARGIN_NAMES[Math.round((value - MARGIN.min) / MARGIN.step)] ?? `${value}px`;

function GraphicsTab() {
  const { level, transitions, hudScale, margin, frame } = useGraphics();
  return (
    <div className={styles.tab}>
      <Choice
        label="Mức đồ họa"
        options={LEVELS}
        value={level}
        onChange={(value) => graphics.set({ level: value === 'low' ? 'low' : 'high' })}
      />
      <Toggle
        label="Hiệu ứng chuyển cảnh"
        checked={transitions}
        onChange={(checked) => graphics.set({ transitions: checked })}
      />
      {canScaleHud() && (
        <Slider
          label="Cỡ giao diện"
          value={hudScale}
          {...HUD_SCALE}
          marks
          format={percent}
          onChange={(value) => graphics.set({ hudScale: value })}
        />
      )}
      <Select
        label="Khung hình"
        options={FRAMES.map(({ id, label }) => ({ value: id, label }))}
        value={frame}
        onChange={(value) => isFrameId(value) && graphics.set({ frame: value })}
      />
      <Slider
        label="Lề màn hình"
        value={margin}
        {...MARGIN}
        marks
        format={marginName}
        onChange={(value) => graphics.set({ margin: value })}
      />
    </div>
  );
}

function SoundTab() {
  const muted = useMuted();
  const volume = useVolume();
  const music = useMusic();
  const effects = useEffects();
  return (
    <div className={styles.tab}>
      <Toggle label="Âm thanh" checked={!muted} onChange={(on) => sounds.setMuted(!on)} />
      <Slider
        label="Âm lượng chung"
        value={Math.round(volume * 100)}
        step={5}
        format={percent}
        disabled={muted}
        onChange={(value) => sounds.setVolume(value / 100)}
      />
      <Slider
        label="Nhạc"
        value={Math.round(music * 100)}
        step={5}
        format={percent}
        disabled={muted}
        onChange={(value) => sounds.setMusic(value / 100)}
      />
      <Slider
        label="Hiệu ứng"
        value={Math.round(effects * 100)}
        step={5}
        format={percent}
        disabled={muted}
        onChange={(value) => sounds.setEffects(value / 100)}
      />
    </div>
  );
}

function AccountTab() {
  const user = useHub((s) => s.user);
  return (
    <div className={styles.about}>
      {user && (
        <div className={styles.title}>
          <p className={styles.name}>{user.name}</p>
          <p className={styles.version}>@{user.username}</p>
        </div>
      )}
      <Button sound="close" className={styles.logout} onClick={() => hub.logout()}>
        Đăng xuất
      </Button>
    </div>
  );
}

function AboutTab() {
  return (
    <div className={styles.about}>
      <div className={styles.title}>
        <p className={styles.name}>Xóm Đảo</p>
        <p className={styles.version}>Phiên bản {__APP_VERSION__}</p>
      </div>
      <p>Chơi game cùng bạn bè ngay trên trình duyệt.</p>
      <ul className={styles.games} aria-label="Các trò">
        {GAMES.map((game) => (
          <li key={game.manifest.id}>
            <Chip>{game.manifest.name}</Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TABS = [
  { id: 'graphics', label: 'Đồ họa', content: <GraphicsTab /> },
  { id: 'sound', label: 'Âm thanh', content: <SoundTab /> },
  { id: 'about', label: 'Giới thiệu', content: <AboutTab /> },
];

const ACCOUNT = { id: 'account', label: 'Tài khoản', content: <AccountTab /> };

export interface SettingsOverlayProps {
  open: boolean;
  /** The Game being played: its preferences, if it declares any, come first in a tab of its own. */
  game?: GameManifest;
  onClose(): void;
}

/**
 * The Hub's settings: a full-screen frosted overlay (a modal `<dialog>`) with one tab each for
 * graphics, sound and About, and outside a Room one for the account (sign out). The title and tabs stay where they are whichever tab shows; nothing scrolls.
 */
export function SettingsOverlay({ open, game, onClose }: SettingsOverlayProps) {
  const modal = useModal(open, onClose);
  const dismiss = () => {
    playSound('close');
    onClose();
  };
  const titleId = useId();
  const tabs =
    game && Object.keys(game.preferences ?? {}).length > 0
      ? [
          {
            id: 'game',
            label: game.name,
            content: (
              <div className={styles.tab}>
                <PreferenceFields manifest={game} />
              </div>
            ),
          },
          ...TABS,
        ]
      : game
        ? TABS
        : [...TABS, ACCOUNT];

  return (
    <dialog {...modal} className={styles.overlay} aria-labelledby={titleId}>
      <div className={styles.frame}>
        <header className={styles.top}>
          <h2 id={titleId}>Cài đặt</h2>
          <button type="button" className={styles.close} aria-label="Đóng" onClick={dismiss}>
            <Icon icon={IconX} />
          </button>
        </header>
        {open && <Tabs label="Cài đặt" tabs={tabs} />}
      </div>
    </dialog>
  );
}
