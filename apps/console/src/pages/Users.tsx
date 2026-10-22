import { useCallback, useEffect, useState } from 'react';
import { type Account, type AccountPage, api } from '../api';
import { Dialog, Field, message, useSubmit } from '../Dialog';

type Editing =
  | { kind: 'create' }
  | { kind: 'edit'; user: Account }
  | { kind: 'delete'; user: Account }
  | null;

const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** Người dùng: search, create, rename / reset password, delete accounts. */
export function Users() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AccountPage | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<Editing>(null);

  // Search once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(() => {
    api.users(search, page).then(
      (result) => {
        setData(result);
        setLoadError('');
      },
      (err: unknown) => setLoadError(message(err)),
    );
  }, [search, page]);

  useEffect(load, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Người dùng</h1>
          <p className="muted">{data ? `${data.total} tài khoản` : 'Đang tải…'}</p>
        </div>
        <button type="button" className="primary" onClick={() => setEditing({ kind: 'create' })}>
          Thêm tài khoản
        </button>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Tìm theo tên đăng nhập hoặc tên"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm tài khoản"
        />
      </div>

      {loadError && <p className="error">{loadError}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên đăng nhập</th>
              <th>Tên hiển thị</th>
              <th className="hide-sm">Ngày tạo</th>
              <th aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {data?.users.map((user) => (
              <tr key={user.id}>
                <td className="mono">{user.username}</td>
                <td>{user.name}</td>
                <td className="hide-sm muted">{dateFormat.format(new Date(user.createdAt))}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setEditing({ kind: 'edit', user })}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="ghost small danger-text"
                    onClick={() => setEditing({ kind: 'delete', user })}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {data && data.users.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  Không có tài khoản nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="pager">
          <button
            type="button"
            className="ghost small"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Trước
          </button>
          <span className="muted">
            Trang {page}/{pages}
          </span>
          <button
            type="button"
            className="ghost small"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </button>
        </div>
      )}

      {editing?.kind === 'create' && (
        <CreateUser
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {editing?.kind === 'edit' && (
        <EditUser
          user={editing.user}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {editing?.kind === 'delete' && (
        <DeleteUser
          user={editing.user}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}

interface FormProps {
  onClose: () => void;
  onDone: () => void;
}

function CreateUser({ onClose, onDone }: FormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      title="Thêm tài khoản"
      submitLabel="Tạo"
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api.createUser({ username, password, name }))}
    >
      <Field label="Tên đăng nhập">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          required
        />
      </Field>
      <Field label="Mật khẩu">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label="Tên hiển thị">
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
    </Dialog>
  );
}

function EditUser({ user, onClose, onDone }: FormProps & { user: Account }) {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      title={`Sửa ${user.username}`}
      submitLabel="Lưu"
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() =>
        run(() =>
          api.updateUser(user.id, {
            ...(name !== user.name ? { name } : {}),
            ...(password ? { password } : {}),
          }),
        )
      }
    >
      <Field label="Tên hiển thị">
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Mật khẩu mới (để trống nếu giữ nguyên)">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
    </Dialog>
  );
}

function DeleteUser({ user, onClose, onDone }: FormProps & { user: Account }) {
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      title="Xoá tài khoản?"
      submitLabel="Xoá"
      danger
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api.deleteUser(user.id))}
    >
      <p>
        Xoá <strong>{user.username}</strong> ({user.name}) cùng xu, túi đồ và thành tích. Không hoàn
        tác được.
      </p>
    </Dialog>
  );
}
