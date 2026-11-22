import { IconBell, IconDots, IconMail, IconUsers } from '@tabler/icons-react';
import { useState } from 'react';
import { GAMES } from '../../games.js';
import {
  Button,
  Chip,
  Choice,
  CoinIcon,
  CutPanel,
  Dialog,
  GemIcon,
  Icon,
  Loop,
  Menu,
  OnlineDot,
  Sheet,
  SignalIcon,
  Slider,
  SyncIcon,
  Tabs,
  TextField,
  Toggle,
  toast,
} from '../../kit/index.js';
import type { GraphicsLevel } from '../../settings/graphics.js';
import { PersonRow } from '../friends/PersonRow.js';
import { OfflineOverlay } from '../offline/OfflineOverlay.js';
import screen from '../Screen.module.css';
import { SettingsOverlay } from '../settings/SettingsOverlay.js';
import styles from './Kit.module.css';
import { MotionLab } from './MotionLab.js';

/** Phone landscape frames the kit is checked at, each at one graphics level. */
const FRAMES: { width: number; height: number; level: GraphicsLevel; reduce?: boolean }[] = [
  { width: 844, height: 390, level: 'high' },
  { width: 844, height: 390, level: 'low' },
  { width: 844, height: 390, level: 'high', reduce: true },
  { width: 667, height: 375, level: 'high' },
];

const LEVEL_NAMES: Record<GraphicsLevel, string> = { high: 'Cao', low: 'Thấp' };

const MODES = [
  { value: 'quick', label: 'Nhanh' },
  { value: 'normal', label: 'Thường' },
  { value: 'long', label: 'Dài' },
];

/** The looping HUD icons, each under the name it is reviewed by. */
function Loops() {
  return (
    <ul className={styles.loops}>
      <li>
        <SignalIcon />
        Kết nối
      </li>
      <li>
        <Loop kind="swing">
          <Icon icon={IconBell} />
        </Loop>
        Chuông
      </li>
      <li>
        <span className={styles.dotBox}>
          <OnlineDot />
        </span>
        Trực tuyến
      </li>
      <li>
        <Loop kind="glint">
          <CoinIcon />
        </Loop>
        Xu
      </li>
      <li>
        <SyncIcon />
        Đồng bộ
      </li>
      <li>
        <Loop kind="bob" pip>
          <Icon icon={IconMail} />
        </Loop>
        Thư mời
      </li>
    </ul>
  );
}

function Samples() {
  const [dialog, setDialog] = useState<'box' | 'band' | null>(null);
  const [sheet, setSheet] = useState(false);
  const [offline, setOffline] = useState(false);
  const [mode, setMode] = useState('normal');
  const [bots, setBots] = useState(true);
  const [settings, setSettings] = useState(false);
  const [volume, setVolume] = useState(70);

  return (
    <div className={styles.samples}>
      <div className={styles.column}>
        <div className={styles.row}>
          <Button variant="primary" forward>
            Ra khơi
          </Button>
          <Button>Thêm máy</Button>
          <Button variant="ghost">Rời</Button>
          <Button disabled>Tắt</Button>
        </div>
        <div className={styles.row}>
          <Chip>2–4 người</Chip>
          <Chip tone="accent">Chủ phòng</Chip>
          <Chip tone="ready">Sẵn sàng</Chip>
          <Chip tone="danger">Mất kết nối</Chip>
        </div>
        <div className={styles.row}>
          <Icon icon={IconUsers} />
          <CoinIcon />
          <span className={styles.value}>1 250</span>
          <GemIcon />
          <span className={styles.value}>40</span>
        </div>
        <Loops />
        <Tabs
          label="Mẫu tab"
          tabs={[
            {
              id: 'rules',
              label: 'Luật',
              content: <p className={styles.note}>Đánh hết bài trước.</p>,
            },
            {
              id: 'stats',
              label: 'Thành tích',
              content: <p className={styles.note}>Chưa có ván nào.</p>,
            },
          ]}
        />
      </div>
      <div className={styles.column}>
        <CutPanel label="Phòng / 4821">
          <div className={styles.stack}>
            <Choice label="Tốc độ" options={MODES} value={mode} onChange={setMode} />
            <Toggle label="Thêm máy" checked={bots} onChange={setBots} />
            <Slider
              label="Âm lượng"
              value={volume}
              step={5}
              format={(v) => `${v}%`}
              onChange={setVolume}
            />
          </div>
        </CutPanel>
        <TextField label="Mã phòng" placeholder="ABCD" />
        <div className={styles.row}>
          <Menu
            label="Menu"
            trigger={<Icon icon={IconDots} />}
            items={[
              { label: 'Cài đặt', onSelect: () => setSettings(true) },
              { label: 'Rời phòng', onSelect: () => setDialog('band'), danger: true },
            ]}
          />
          <Button onClick={() => toast('Lan đã kết nối lại')}>Tin</Button>
          <Button onClick={() => toast('Đã gửi lời mời', 'success')}>Xong</Button>
          <Button onClick={() => toast('Máy 1 đã rời ván', 'warning')}>Cảnh báo</Button>
          <Button onClick={() => toast('Mất kết nối', 'danger')}>Lỗi</Button>
        </div>
        <div className={styles.row}>
          <Button onClick={() => setDialog('box')}>Hộp</Button>
          <Button onClick={() => setDialog('band')}>Dải ngang</Button>
          <Button onClick={() => setSheet(true)}>Sheet</Button>
          <Button onClick={() => setOffline(true)}>Mất mạng</Button>
          <Button onClick={() => setSettings(true)}>Cài đặt</Button>
        </div>
      </div>
      <SettingsOverlay open={settings} onClose={() => setSettings(false)} />
      <OfflineOverlay open={offline} onDismiss={() => setOffline(false)} />
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Hàng xóm">
        <ul className={styles.people}>
          <PersonRow name="Lan" detail="Ở Bến" online />
          <PersonRow name="Minh" detail="Đang chơi Caro" online />
          <PersonRow name="Hải" detail="Ngoại tuyến" dim />
        </ul>
      </Sheet>
      <Dialog
        open={dialog === 'box'}
        onClose={() => setDialog(null)}
        title="Đã gửi lời mời"
        actions={
          <Button variant="primary" onClick={() => setDialog(null)}>
            Đã hiểu
          </Button>
        }
      >
        <p>Lan sẽ thấy lời mời khi vào Bến.</p>
      </Dialog>
      <Dialog
        open={dialog === 'band'}
        onClose={() => setDialog(null)}
        look="band"
        kicker="Xác nhận"
        title="Rời ván?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Ở lại
            </Button>
            <Button variant="primary" onClick={() => setDialog(null)}>
              Rời
            </Button>
          </>
        }
      >
        <p>Bạn sẽ bị tính hạng chót.</p>
      </Dialog>
    </div>
  );
}

/**
 * `/dev/kit`, dev only: every kit component at the phone frames, at both graphics levels and with
 * less motion; toasts follow the real setting. `#motion` shows the motion prototype full screen.
 */
export function Kit() {
  if (location.hash === '#motion') return <MotionLab full />;
  const art = (GAMES.find((g) => g.manifest.id === 'caro') ?? GAMES[0])?.art.lobby;
  return (
    <main className={screen.screen}>
      <h1 className={screen.brand}>Kit</h1>
      <div className={styles.frames}>
        {FRAMES.map(({ width, height, level, reduce }) => {
          const name = `${width}×${height} · ${LEVEL_NAMES[level]}${reduce ? ' · giảm chuyển động' : ''}`;
          return (
            <figure key={name} className={styles.figure}>
              <figcaption className={styles.caption}>{name}</figcaption>
              <section
                className={styles.frame}
                style={{ width, height }}
                data-graphics={level}
                data-reduce={reduce || undefined}
                aria-label={name}
              >
                {art && <img className={styles.art} src={art} alt="" />}
                <Samples />
              </section>
            </figure>
          );
        })}
        <MotionLab />
      </div>
    </main>
  );
}
