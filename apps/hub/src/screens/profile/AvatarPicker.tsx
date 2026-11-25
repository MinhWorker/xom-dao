import { AVATARS, type Avatar } from '@xomdao/shared/client';
import { useState } from 'react';
import { Sheet, toast } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { playSound } from '../../sound/index.js';
import { avatarSrc, frameSrc } from '../harbour/portrait.js';
import styles from './AvatarPicker.module.css';

/** The friends drawn for the Bến and the other people come before the animals. */
const PEOPLE: readonly Avatar[] = ['harbour', 'dang', 'nam', 'long', 'boy', 'girl'];
const ORDER = [...PEOPLE, ...AVATARS.filter((id) => !PEOPLE.includes(id))];

export interface AvatarPickerProps {
  open: boolean;
  onClose(): void;
}

/** Every avatar in a grid, in the player's frame; picking one saves it and closes. */
export function AvatarPicker({ open, onClose }: AvatarPickerProps) {
  const me = useHub((s) => s.user);
  const [busy, setBusy] = useState(false);

  async function pick(avatar: Avatar) {
    if (!me || busy) return;
    playSound('click');
    if (avatar === me.avatar) return onClose();
    setBusy(true);
    try {
      await hub.request('profile:update', { name: me.name, avatar, frame: me.frame });
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Không đổi được ảnh', 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ảnh đại diện">
      <ul className={styles.grid}>
        {ORDER.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={styles.choice}
              aria-label={`Ảnh ${id}`}
              aria-pressed={id === me?.avatar}
              disabled={busy}
              onClick={() => void pick(id)}
            >
              <img src={avatarSrc(id)} alt="" draggable={false} />
              <img src={frameSrc(me?.frame ?? '')} alt="" draggable={false} />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
