import { lazy, Suspense, useEffect, useState } from 'react';
import { Button, SignalIcon } from './kit/index.js';
import { hub, useHub } from './net/hub.js';
import { OFFLINE } from './net/store.js';
import { navigate, useRoute } from './router.js';
import { InviteNotice } from './screens/friends/InviteNotice.js';
import { Harbour } from './screens/harbour/Harbour.js';
import { Login } from './screens/login/Login.js';
import { OfflineOverlay } from './screens/offline/OfflineOverlay.js';
import { Profile } from './screens/profile/Profile.js';
import { Room } from './screens/room/Room.js';
import screen from './screens/Screen.module.css';
import { SeaChart } from './screens/sea/SeaChart.js';

/** How long the connection may be down before the offline overlay covers the screen. */
const OFFLINE_GRACE_MS = 1000;

/** Waits out a short drop, then covers the screen until the Hub is back or the player dismisses it. */
function Offline({ down }: { down: boolean }) {
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!down) {
      setShown(false);
      setDismissed(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), OFFLINE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [down]);

  return (
    <>
      {down && dismissed && (
        <div className={screen.banner} role="status">
          {OFFLINE}
        </div>
      )}
      <OfflineOverlay open={shown && !dismissed} onDismiss={() => setDismissed(true)} />
    </>
  );
}

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
    if (roomCode && route.name === 'harbour') navigate(`/room/${roomCode}`, { replace: true });
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
        <p className={`${screen.dim} ${screen.connecting}`}>
          <SignalIcon size={28} />
          Đang kết nối…
        </p>
      </main>
    );
  }
  return (
    <>
      <Offline down={phase === 'offline'} />
      {route.name === 'room' && <Room key={route.code} code={route.code} />}
      {route.name === 'sea' && <SeaChart />}
      {route.name === 'profile' && <Profile key={route.userId ?? 'me'} userId={route.userId} />}
      {(route.name === 'harbour' || route.name === 'kit') && <Harbour />}
      <InviteNotice />
    </>
  );
}
