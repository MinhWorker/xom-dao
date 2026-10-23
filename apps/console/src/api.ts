/** Where the API is: baked in at build time (vite.config.ts), else this page's origin. */
declare const __SERVER_URL__: string;

const TOKEN_KEY = 'xomdao:console-token';

export interface Account {
  id: string;
  username: string;
  name: string;
  avatar: string;
  frame: string;
  createdAt: string;
}

export interface AccountPage {
  users: Account[];
  total: number;
  pageSize: number;
}

export type ItemSlot = 'avatar' | 'frame' | 'card-back' | 'emote';

export interface Item {
  id: string;
  slot: ItemSlot;
  look: string;
  name: string;
  price: number;
}

export interface ItemList {
  items: Item[];
  slots: ItemSlot[];
  looks: Record<ItemSlot, string[]>;
}

/** A letter sent to Hộp thư; `to` is a username, "" for everyone. */
export interface SentLetter {
  id: string;
  to: string;
  title: string;
  body: string;
  coins: number;
  sentAt: string;
}

/** A refused request; `message` is Vietnamese, ready to show. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function savedToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

let token = savedToken();
let onLoggedOut = () => {};

/** Called when the server no longer takes the token (expired, or the server restarted). */
export function whenLoggedOut(fn: () => void) {
  onLoggedOut = fn;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${__SERVER_URL__}/api/console${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ', 0);
  }
  const data = (await res.json().catch(() => ({}))) as { message?: unknown };
  if (res.status === 401 && path !== '/login') {
    logoutLocally();
    onLoggedOut();
  }
  if (!res.ok) {
    const message = typeof data.message === 'string' ? data.message : 'Máy chủ gặp lỗi';
    throw new ApiError(message, res.status);
  }
  return data as T;
}

function logoutLocally() {
  token = '';
  saveToken('');
}

export const api = {
  question: () => call<{ question: string }>('GET', '/question'),
  async login(answer: string) {
    const result = await call<{ token: string }>('POST', '/login', { answer });
    token = result.token;
    saveToken(token);
  },
  async logout() {
    await call('POST', '/logout').catch(() => {});
    logoutLocally();
  },

  users: (q: string, page: number) =>
    call<AccountPage>('GET', `/users?${new URLSearchParams({ q, page: String(page) })}`),
  createUser: (body: { username: string; password: string; name: string }) =>
    call<{ user: Account }>('POST', '/users', body),
  updateUser: (id: string, body: { name?: string; password?: string }) =>
    call<{ user: Account }>('PATCH', `/users/${encodeURIComponent(id)}`, body),
  deleteUser: (id: string) => call('DELETE', `/users/${encodeURIComponent(id)}`),

  items: () => call<ItemList>('GET', '/items'),
  createItem: (item: Item) => call<{ item: Item }>('POST', '/items', item),
  updateItem: (id: string, change: Omit<Item, 'id'>) =>
    call<{ item: Item }>('PATCH', `/items/${encodeURIComponent(id)}`, change),
  deleteItem: (id: string) => call('DELETE', `/items/${encodeURIComponent(id)}`),

  letters: () => call<{ letters: SentLetter[] }>('GET', '/mail'),
  sendLetter: (letter: { to: string; title: string; body: string; coins: number }) =>
    call<{ letter: SentLetter }>('POST', '/mail', letter),
  deleteLetter: (id: string) => call('DELETE', `/mail/${encodeURIComponent(id)}`),
};
