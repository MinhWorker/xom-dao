import { useEffect, useState } from 'react';
import { api, savedToken, whenLoggedOut } from './api';
import { Gate } from './Gate';
import { Events } from './pages/Events';
import { Items } from './pages/Items';
import { Mail } from './pages/Mail';
import { Users } from './pages/Users';
import { go, PAGES, usePage } from './router';

export function App() {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(savedToken()));
  const page = usePage();

  useEffect(() => whenLoggedOut(() => setLoggedIn(false)), []);

  if (!loggedIn) return <Gate onPass={() => setLoggedIn(true)} />;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>Xóm Đảo</strong>
            <small>Quản lý</small>
          </div>
        </div>
        <nav>
          {PAGES.map((p) => (
            <a
              key={p.id}
              href={`/console/${p.id}`}
              className={p.id === page ? 'active' : undefined}
              aria-current={p.id === page ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(p.id);
              }}
            >
              {p.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="ghost logout"
          onClick={async () => {
            await api.logout();
            setLoggedIn(false);
          }}
        >
          Thoát
        </button>
      </aside>
      <main className="content">
        {page === 'users' && <Users />}
        {page === 'items' && <Items />}
        {page === 'mail' && <Mail />}
        {page === 'events' && <Events />}
      </main>
    </div>
  );
}
