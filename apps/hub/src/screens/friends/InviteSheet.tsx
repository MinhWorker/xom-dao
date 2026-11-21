import { IconLink } from '@tabler/icons-react';
import { useState } from 'react';
import { gameById } from '../../games.js';
import { Button, Chip, Icon, Sheet } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import styles from './FriendsSheet.module.css';
import { canInvite, groupFriends, presenceLabel } from './groups.js';
import { PersonRow } from './PersonRow.js';

export interface InviteSheetProps {
  open: boolean;
  onClose(): void;
  roomCode: string;
  /** Copies the Room's link, for someone who is not a friend here. */
  onCopyLink(): void;
}

/** Friends to ask into the Room: each online one gets an invite, which they answer on their screen. */
export function InviteSheet({ open, onClose, roomCode, onCopyLink }: InviteSheetProps) {
  const friends = groupFriends(useHub((s) => s.friends)).friends;
  const [asked, setAsked] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');

  async function invite(userId: string) {
    setError('');
    try {
      await hub.request('friends:invite', { userId });
      setAsked((now) => new Set(now).add(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Máy chủ gặp lỗi');
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Mời bạn">
      <div className={styles.lists}>
        <Button onClick={onCopyLink}>
          <Icon icon={IconLink} size={20} /> Chép liên kết phòng
        </Button>
        {friends.length > 0 ? (
          <ul className={styles.list}>
            {friends.map((f) => {
              const here = f.roomCode === roomCode;
              return (
                <PersonRow
                  key={f.id}
                  name={f.name}
                  detail={presenceLabel(
                    f,
                    f.gameId ? gameById(f.gameId)?.manifest.name : undefined,
                  )}
                  online={f.online}
                  dim={!f.online}
                >
                  {here ? (
                    <Chip tone="ready">Trong phòng</Chip>
                  ) : asked.has(f.id) ? (
                    <Chip>Đã mời</Chip>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={!canInvite(f, roomCode)}
                      aria-label={`Mời ${f.name}`}
                      onClick={() => void invite(f.id)}
                    >
                      Mời
                    </Button>
                  )}
                </PersonRow>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>Chưa có bạn bè.</p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
