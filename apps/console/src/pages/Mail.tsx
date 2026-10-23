import { useCallback, useEffect, useState } from 'react';
import { api, type SentLetter } from '../api';
import { Dialog, Field, message, useSubmit } from '../Dialog';

type Editing = { kind: 'send' } | { kind: 'delete'; letter: SentLetter };

const coinFormat = new Intl.NumberFormat('vi-VN');
const timeFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** Thư: letters to Hộp thư in the hub, to one player or to everyone, maybe with coins. */
export function Mail() {
  const [letters, setLetters] = useState<SentLetter[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);

  const load = useCallback(() => {
    api.letters().then(
      (result) => {
        setLetters(result.letters);
        setLoadError('');
      },
      (err: unknown) => setLoadError(message(err)),
    );
  }, []);
  useEffect(load, [load]);

  const done = () => {
    setEditing(null);
    load();
  };

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Thư</h1>
          <p className="muted">{letters ? `${letters.length} thư gần nhất` : 'Đang tải…'}</p>
        </div>
        <button type="button" className="primary" onClick={() => setEditing({ kind: 'send' })}>
          Gửi thư
        </button>
      </header>

      {loadError && <p className="error">{loadError}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thư</th>
              <th className="hide-sm">Gửi tới</th>
              <th className="num">Quà</th>
              <th className="hide-sm">Lúc</th>
              <th aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {letters?.map((letter) => (
              <tr key={letter.id}>
                <td>
                  <strong>{letter.title}</strong>
                  <div className="muted letter-body">{letter.body}</div>
                </td>
                <td className="hide-sm">
                  {letter.to ? (
                    <span className="mono">{letter.to}</span>
                  ) : (
                    <span className="badge">Cả xóm</span>
                  )}
                </td>
                <td className="num">
                  {letter.coins > 0 ? `${coinFormat.format(letter.coins)} xu` : '—'}
                </td>
                <td className="hide-sm muted">{timeFormat.format(new Date(letter.sentAt))}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="ghost small danger-text"
                    onClick={() => setEditing({ kind: 'delete', letter })}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {letters?.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  Chưa gửi thư nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing?.kind === 'send' && <SendLetter onClose={() => setEditing(null)} onDone={done} />}
      {editing?.kind === 'delete' && (
        <DeleteLetter letter={editing.letter} onClose={() => setEditing(null)} onDone={done} />
      )}
    </section>
  );
}

interface FormProps {
  onClose: () => void;
  onDone: () => void;
}

function SendLetter({ onClose, onDone }: FormProps) {
  const [to, setTo] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coins, setCoins] = useState('0');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      title="Gửi thư"
      submitLabel={to.trim() ? `Gửi cho ${to.trim()}` : 'Gửi cả xóm'}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api.sendLetter({ to, title, body, coins: Number(coins) }))}
    >
      <Field label="Tên đăng nhập người nhận (bỏ trống để gửi cả xóm)">
        <input value={to} onChange={(e) => setTo(e.target.value)} maxLength={40} />
      </Field>
      <Field label="Tiêu đề">
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={60} />
      </Field>
      <Field label="Nội dung">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          maxLength={1000}
        />
      </Field>
      <Field label="Quà (xu, 0 = không có)">
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={coins}
          onChange={(e) => setCoins(e.target.value)}
          required
        />
      </Field>
    </Dialog>
  );
}

function DeleteLetter({ letter, onClose, onDone }: FormProps & { letter: SentLetter }) {
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      title="Xoá thư?"
      submitLabel="Xoá"
      danger
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api.deleteLetter(letter.id))}
    >
      <p>
        <strong>{letter.title}</strong> sẽ biến mất khỏi Hộp thư của người nhận. Xu đã nhận thì vẫn
        giữ.
      </p>
    </Dialog>
  );
}
