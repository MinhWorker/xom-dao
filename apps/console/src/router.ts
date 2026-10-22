import { useEffect, useState } from 'react';

/** The console lives under /console; pages are /console/<page>. */
export const BASE = '/console';

export type Page = 'users' | 'items' | 'events';
export const PAGES: { id: Page; label: string }[] = [
  { id: 'users', label: 'Người dùng' },
  { id: 'items', label: 'Vật phẩm' },
  { id: 'events', label: 'Sự kiện' },
];

function current(): Page {
  const name = location.pathname.slice(BASE.length).split('/').filter(Boolean)[0];
  return PAGES.find((page) => page.id === name)?.id ?? 'users';
}

export function go(page: Page) {
  if (current() === page && location.pathname !== BASE) return;
  history.pushState(null, '', `${BASE}/${page}`);
  dispatchEvent(new PopStateEvent('popstate'));
}

/** The page in the address bar; /console and unknown paths show Người dùng. */
export function usePage(): Page {
  const [page, setPage] = useState(current);
  useEffect(() => {
    if (location.pathname.replace(/\/$/, '') === BASE) {
      history.replaceState(null, '', `${BASE}/users`);
    }
    const update = () => setPage(current());
    addEventListener('popstate', update);
    return () => removeEventListener('popstate', update);
  }, []);
  return page;
}
