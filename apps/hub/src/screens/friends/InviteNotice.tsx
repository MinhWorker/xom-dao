import { useEffect } from 'react';
import { gameById } from '../../games.js';
import { Button, Chip, Dialog } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate } from '../../router.js';
import styles from './InviteNotice.module.css';

/**
 * A friend's invite as a dialog over whatever screen is open. It waits while a Match is playing
 * and never shows for the Room you are already in.
 */
export function InviteNotice() {
  const invite = useHub((s) => s.invite);
  const roomCode = useHub((s) => s.room?.code);
  const playing = useHub((s) => s.room?.status === 'playing');
  const here = invite !== null && invite.roomCode === roomCode;

  useEffect(() => {
    if (here) hub.dismissInvite();
  }, [here]);

  const show = invite !== null && !here && !playing;
  const game = invite ? gameById(invite.gameId) : undefined;

  function accept() {
    if (!invite) return;
    hub.dismissInvite();
    navigate(`/room/${invite.roomCode}`);
  }

  return (
    <Dialog
      open={show}
      onClose={() => hub.dismissInvite()}
      title={invite ? `${invite.fromName} mời bạn` : 'Lời mời'}
      actions={
        <>
          <Button variant="ghost" onClick={() => hub.dismissInvite()}>
            Để sau
          </Button>
          <Button variant="primary" onClick={accept}>
            Vào phòng
          </Button>
        </>
      }
    >
      {invite && (
        <div className={styles.what}>
          <span className={styles.game}>{game?.manifest.name ?? invite.gameId}</span>
          <Chip tone="accent">{invite.roomCode}</Chip>
        </div>
      )}
    </Dialog>
  );
}
