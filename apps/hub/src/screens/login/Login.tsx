import { DEFAULT_FRAME, STARTER_AVATARS } from '@xomdao/shared/client';
import { type FormEvent, useState } from 'react';
import { Button, CutPanel, TextField, useFormReady } from '../../kit/index.js';
import { hub } from '../../net/hub.js';
import screen from '../Screen.module.css';
import styles from './Login.module.css';

type Mode = 'login' | 'register';

export function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { ready, form } = useFormReady(mode);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '');
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await hub.login(username, password);
      else
        await hub.register({
          username,
          password,
          name: String(form.get('name') ?? ''),
          avatar: STARTER_AVATARS[0],
          frame: DEFAULT_FRAME,
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Máy chủ gặp lỗi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Xóm Đảo</h1>
      <CutPanel>
        <div className={styles.tabs} role="tablist">
          {(['login', 'register'] as const).map((m) => (
            <Button
              key={m}
              variant="ghost"
              role="tab"
              aria-selected={mode === m}
              className={styles.tab}
              onClick={() => {
                setMode(m);
                setError('');
              }}
            >
              {m === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </Button>
          ))}
        </div>
        <form {...form} className={styles.form} onSubmit={submit}>
          <TextField
            label="Tên đăng nhập"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
          />
          <TextField
            label="Mật khẩu"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {mode === 'register' && <TextField label="Tên hiển thị" name="name" required />}
          {error && (
            <p className={screen.error} role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" type="submit" disabled={busy || !ready}>
            {mode === 'login' ? 'Vào' : 'Tạo'}
          </Button>
        </form>
      </CutPanel>
    </main>
  );
}
