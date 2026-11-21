import { IconBell, IconDots, IconUsers } from '@tabler/icons-react';
import { useState } from 'react';
import {
  Button,
  Chip,
  Choice,
  CoinIcon,
  CutPanel,
  Dialog,
  GemIcon,
  Icon,
  Menu,
  Tabs,
  TextField,
  Toggle,
  toast,
} from '../../kit/index.js';
import screen from '../Screen.module.css';
import styles from './Kit.module.css';

/** Phone landscape frames the kit is checked at. */
const FRAMES = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
];

const MODES = [
  { value: 'quick', label: 'Nhanh' },
  { value: 'normal', label: 'Thường' },
  { value: 'long', label: 'Dài' },
];

function Samples() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('normal');
  const [bots, setBots] = useState(true);

  return (
    <div className={styles.samples}>
      <div className={styles.column}>
        <div className={styles.row}>
          <Button variant="primary">Bắt đầu</Button>
          <Button>Thêm máy</Button>
          <Button variant="ghost">Rời phòng</Button>
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
          <Icon icon={IconBell} label="Thông báo" />
          <CoinIcon />
          <span className={styles.value}>1 250</span>
          <GemIcon />
          <span className={styles.value}>40</span>
        </div>
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
          </div>
        </CutPanel>
        <TextField label="Mã phòng" placeholder="ABCD" />
        <div className={styles.row}>
          <Menu
            label="Menu"
            trigger={<Icon icon={IconDots} />}
            items={[
              { label: 'Cài đặt', onSelect: () => toast('Đã mở cài đặt') },
              { label: 'Rời phòng', onSelect: () => setOpen(true), danger: true },
            ]}
          />
          <Button onClick={() => toast('Đã sao chép mã phòng')}>Thông báo</Button>
          <Button onClick={() => toast('Mất kết nối', 'danger')}>Báo lỗi</Button>
          <Button onClick={() => setOpen(true)}>Hộp thoại</Button>
        </div>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rời ván?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Ở lại
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
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

/** `/dev/kit`, dev only: every kit component at the phone frames. */
export function Kit() {
  return (
    <main className={screen.screen}>
      <h1 className={screen.brand}>Kit</h1>
      <div className={styles.frames}>
        {FRAMES.map(({ width, height }) => (
          <section
            key={width}
            className={styles.frame}
            style={{ width, height }}
            aria-label={`${width}×${height}`}
          >
            <Samples />
          </section>
        ))}
      </div>
    </main>
  );
}
