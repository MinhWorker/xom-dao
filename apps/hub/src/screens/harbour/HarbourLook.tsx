import { IconCheck, IconLock, IconX } from '@tabler/icons-react';
import { useId } from 'react';
import { BACKGROUNDS, CHARACTERS, type HarbourArt } from '../../harbour-art/arts.js';
import { Icon, Tabs } from '../../kit/index.js';
import { useModal } from '../../kit/modal.js';
import { type HarbourLook, harbourLook, useHarbourLook } from '../../settings/harbour.js';
import { hoverSound, playSound } from '../../sound/index.js';
import styles from './HarbourLook.module.css';

interface ArtPickerProps {
  label: string;
  arts: readonly HarbourArt[];
  selected: string;
  shape: 'character' | 'background';
  onPick(id: string): void;
}

/** The arts of one kind as cards, one selected, and an empty "Sắp có" slot where the next one goes. */
function ArtPicker({ label, arts, selected, shape, onPick }: ArtPickerProps) {
  return (
    <ul className={styles.grid} aria-label={label} data-shape={shape}>
      {arts.map((art) => {
        const on = art.id === selected;
        return (
          <li key={art.id}>
            <button
              type="button"
              className={styles.card}
              aria-pressed={on}
              onPointerEnter={(e) => hoverSound(e)}
              onClick={() => {
                if (!on) playSound('pick');
                onPick(art.id);
              }}
            >
              <span className={styles.thumb}>
                <img
                  src={art.src}
                  alt=""
                  draggable={false}
                  style={{ objectPosition: shape === 'background' ? art.position : undefined }}
                />
                {on && (
                  <span className={styles.check}>
                    <Icon icon={IconCheck} size={18} />
                  </span>
                )}
              </span>
              <span className={styles.name}>{art.name}</span>
            </button>
          </li>
        );
      })}
      <li>
        <div className={`${styles.card} ${styles.soon}`} aria-disabled="true">
          <span className={styles.thumb}>
            <Icon icon={IconLock} size={28} />
          </span>
          <span className={styles.name}>Sắp có</span>
        </div>
      </li>
    </ul>
  );
}

function Picker({ kind }: { kind: keyof HarbourLook }) {
  const look = useHarbourLook();
  return kind === 'character' ? (
    <ArtPicker
      label="Nhân vật"
      arts={CHARACTERS}
      selected={look.character}
      shape="character"
      onPick={(id) => harbourLook.set({ character: id })}
    />
  ) : (
    <ArtPicker
      label="Phông nền"
      arts={BACKGROUNDS}
      selected={look.background}
      shape="background"
      onPick={(id) => harbourLook.set({ background: id })}
    />
  );
}

const TABS = [
  { id: 'character', label: 'Nhân vật', content: <Picker kind="character" /> },
  { id: 'background', label: 'Phông nền', content: <Picker kind="background" /> },
];

/**
 * Tuỳ chỉnh Bến: a full-screen frosted overlay (a modal `<dialog>`, like the settings) where the
 * player picks the Bến's character and backdrop. A pick shows on the Bến at once and is kept.
 */
export function HarbourLookOverlay({ open, onClose }: { open: boolean; onClose(): void }) {
  const modal = useModal(open, onClose);
  const titleId = useId();

  return (
    <dialog {...modal} className={styles.overlay} aria-labelledby={titleId}>
      <div className={styles.frame}>
        <header className={styles.top}>
          <h2 id={titleId}>Tuỳ chỉnh Bến</h2>
          <button type="button" className={styles.close} aria-label="Đóng" onClick={onClose}>
            <Icon icon={IconX} />
          </button>
        </header>
        {open && <Tabs label="Tuỳ chỉnh Bến" tabs={TABS} />}
      </div>
    </dialog>
  );
}
