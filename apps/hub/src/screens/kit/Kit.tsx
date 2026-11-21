import { useState } from 'react';
import { Button, Chip, CutPanel, Dialog, TextField } from '../../kit/index.js';
import screen from '../Screen.module.css';
import styles from './Kit.module.css';

/** Phone landscape frames the kit is checked at. */
const FRAMES = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
];

function Samples() {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.samples}>
      <div className={styles.row}>
        <Button variant="primary">Bắt đầu</Button>
        <Button>Thêm máy</Button>
        <Button variant="ghost">Rời phòng</Button>
        <Button disabled>Tắt</Button>
      </div>
      <div className={styles.row}>
        <Chip>2–4 người</Chip>
        <Chip tone="accent">Chủ phòng</Chip>
        <Chip tone="ok">Sẵn sàng</Chip>
        <Chip tone="danger">Mất kết nối</Chip>
      </div>
      <CutPanel label="Vào phòng bằng mã">
        <div className={styles.row}>
          <TextField label="Mã phòng" placeholder="ABCD" />
          <Button onClick={() => setOpen(true)}>Mở hộp thoại</Button>
        </div>
      </CutPanel>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rời ván?"
        actions={<Button onClick={() => setOpen(false)}>Đóng</Button>}
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
          <section key={width} className={styles.frame} style={{ width, height }}>
            <Samples />
          </section>
        ))}
      </div>
    </main>
  );
}
