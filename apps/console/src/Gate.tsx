import { type FormEvent, useEffect, useState } from 'react';
import { ApiError, api } from './api';

/** The question asked before the console opens. */
export function Gate({ onPass }: { onPass: () => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.question().then(
      (r) => setQuestion(r.question),
      (err: unknown) => setError(err instanceof ApiError ? err.message : 'Máy chủ gặp lỗi'),
    );
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(answer);
      onPass();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Máy chủ gặp lỗi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form className="card gate-card" onSubmit={submit}>
        <span className="brand-mark big" aria-hidden="true" />
        <h1>Xóm Đảo · Quản lý</h1>
        <label>
          <span>{question || '…'}</span>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: the gate has only this field
            autoFocus
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary" disabled={busy || !answer.trim()}>
          Vào
        </button>
      </form>
    </div>
  );
}
