import { IconDots } from '@tabler/icons-react';
import type { Friend, Person } from '@xomdao/shared/client';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { gameById } from '../../games.js';
import { Button, Chip, Icon, Menu, Sheet, Tabs, TextField, toast } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate } from '../../router.js';
import styles from './FriendsSheet.module.css';
import { groupFriends, presenceLabel } from './groups.js';
import { PersonRow } from './PersonRow.js';

const message = (err: unknown) => (err instanceof Error ? err.message : 'Máy chủ gặp lỗi');

/** Runs a request, showing a refusal under the list; resolves with whether it went through. */
function useAction() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (err) {
      setError(message(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.label}>{label}</h3>
      <ul className={styles.list}>{children}</ul>
    </section>
  );
}

function FriendList({ onClose }: { onClose(): void }) {
  const friends = useHub((s) => s.friends);
  const { error, busy, run } = useAction();
  const groups = groupFriends(friends);

  const answer = (who: Friend, accept: boolean) =>
    run(() => hub.request('friends:answer', { userId: who.id, accept }));
  const remove = (who: Friend) => run(() => hub.request('friends:remove', { userId: who.id }));
  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const empty = friends.length === 0;
  return (
    <div className={styles.lists}>
      {groups.incoming.length > 0 && (
        <Section label="Lời mời">
          {groups.incoming.map((f) => (
            <PersonRow key={f.id} name={f.name} detail={`@${f.username}`}>
              <Button variant="primary" disabled={busy} onClick={() => void answer(f, true)}>
                Nhận
              </Button>
              <Button disabled={busy} onClick={() => void answer(f, false)}>
                Từ chối
              </Button>
            </PersonRow>
          ))}
        </Section>
      )}
      {groups.friends.length > 0 && (
        <Section label="Bạn bè">
          {groups.friends.map((f) => (
            <PersonRow
              key={f.id}
              name={f.name}
              detail={presenceLabel(f, f.gameId ? gameById(f.gameId)?.manifest.name : undefined)}
              online={f.online}
              dim={!f.online}
            >
              {f.roomCode && (
                <Button variant="primary" disabled={busy} onClick={() => go(`/room/${f.roomCode}`)}>
                  Vào
                </Button>
              )}
              <Menu
                label={`Tuỳ chọn ${f.name}`}
                trigger={<Icon icon={IconDots} />}
                items={[
                  { label: 'Hồ sơ', onSelect: () => go(`/profile/${f.id}`) },
                  { label: 'Xoá bạn', danger: true, onSelect: () => void remove(f) },
                ]}
              />
            </PersonRow>
          ))}
        </Section>
      )}
      {groups.outgoing.length > 0 && (
        <Section label="Đã gửi lời mời">
          {groups.outgoing.map((f) => (
            <PersonRow key={f.id} name={f.name} detail={`@${f.username}`} dim>
              <Button variant="ghost" disabled={busy} onClick={() => void remove(f)}>
                Huỷ
              </Button>
            </PersonRow>
          ))}
        </Section>
      )}
      {empty && <p className={styles.empty}>Chưa có bạn bè.</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function AddFriend() {
  const known = useHub((s) => s.friends);
  const [suggested, setSuggested] = useState<Person[] | null>(null);
  const { error, busy, run } = useAction();

  useEffect(() => {
    let live = true;
    hub
      .request('friends:suggest', {})
      .then(({ people }) => live && setSuggested(people))
      .catch(() => live && setSuggested([]));
    return () => {
      live = false;
    };
  }, []);

  /** Asks someone by username; the reply tells whether it became a friendship or a request. */
  const add = (username: string, name?: string) =>
    run(async () => {
      const { friends } = await hub.request('friends:add', { username });
      const them = friends.find((f) => f.username.toLowerCase() === username.toLowerCase());
      const who = name ?? them?.name ?? username;
      toast(
        them?.state === 'friend' ? `Đã kết bạn với ${who}` : `Đã gửi lời mời tới ${who}`,
        'success',
      );
    });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const username = String(new FormData(form).get('username') ?? '').trim();
    if (!username) return;
    if (await add(username)) form.reset();
  }

  const people = (suggested ?? []).filter((p) => !known.some((f) => f.id === p.id));
  return (
    <div className={styles.lists}>
      <form className={styles.find} onSubmit={(e) => void submit(e)}>
        <TextField
          label="Tên đăng nhập"
          name="username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <Button variant="primary" type="submit" disabled={busy}>
          Kết bạn
        </Button>
      </form>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {people.length > 0 && (
        <Section label="Gợi ý">
          {people.map((p) => (
            <PersonRow
              key={p.id}
              name={p.name}
              detail={p.recent ? 'Mới chơi cùng' : `@${p.username}`}
              online={p.online}
            >
              {p.recent && <Chip tone="accent">Gần đây</Chip>}
              <Button disabled={busy} onClick={() => void add(p.username, p.name)}>
                Kết bạn
              </Button>
            </PersonRow>
          ))}
        </Section>
      )}
    </div>
  );
}

export interface FriendsSheetProps {
  open: boolean;
  onClose(): void;
}

/** Bạn bè in a sheet: requests to answer, friends and where they are, and a way to add people. */
export function FriendsSheet({ open, onClose }: FriendsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Bạn bè">
      <Tabs
        label="Bạn bè"
        tabs={[
          { id: 'list', label: 'Danh sách', content: <FriendList onClose={onClose} /> },
          { id: 'add', label: 'Thêm bạn', content: <AddFriend /> },
        ]}
      />
    </Sheet>
  );
}
