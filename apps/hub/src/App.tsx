import { lazy, Suspense, useEffect } from 'react';
import { Button } from './kit/index.js';
import { hub, useHub } from './net/hub.js';
import { OFFLINE } from './net/store.js';
import { navigate, useRoute } from './router.js';
import { InviteNotice } from './screens/friends/InviteNotice.js';
import { Lobby } from './screens/lobby/Lobby.js';
import { Login } from './screens/login/Login.js';
import { Profile } from './screens/profile/Profile.js';
import { Room } from './screens/room/Room.js';
import screen from './screens/Screen.module.css';

const Kit = import.meta.env.DEV
  ? lazy(() => import('./screens/kit/Kit.js').then((m) => ({ default: m.Kit })))
  : null;

export function App() {
  const route = useRoute();
  const phase = useHub((s) => s.phase);
  const user = useHub((s) => s.user);
  const roomCode = useHub((s) => s.room?.code);

  useEffect(() => {
    hub.start();
  }, []);

  useEffect(() => {
    if (roomCode && route.name === 'lobby') navigate(`/room/${roomCode}`, { replace: true });
  }, [roomCode, route.name]);

  if (route.name === 'kit' && Kit) {
    return (
      <Suspense>
        <Kit />
      </Suspense>
    );
  }
  if (phase === 'outdated') {
    return (
      <main className={screen.center}>
        <h1>Đã có bản mới</h1>
        <Button variant="primary" onClick={() => location.reload()}>
          Tải lại
        </Button>
      </main>
    );
  }
  if (phase === 'signed-out') return <Login />;
  if (!user || (phase === 'connecting' && route.name !== 'room')) {
    return (
      <main className={screen.center}>
        <p className={screen.dim}>Đang kết nối…</p>
      </main>
    );
  }
  return (
    <>
      {phase === 'offline' && (
        <div className={screen.banner} role="status">
          {OFFLINE}
        </div>
      )}
      {route.name === 'room' && <Room key={route.code} code={route.code} />}
      {route.name === 'profile' && <Profile key={route.userId ?? 'me'} userId={route.userId} />}
      {(route.name === 'lobby' || route.name === 'kit') && <Lobby />}
      <InviteNotice />
    </>
  );
}
