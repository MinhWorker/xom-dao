import {
  IconAnchor,
  IconBell,
  IconChevronRight,
  IconMail,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import avatarBot from '../../../../../assets/app/images/avatar-bot.webp';
import avatarCat from '../../../../../assets/app/images/avatar-cat.webp';
import avatarFox from '../../../../../assets/app/images/avatar-fox.webp';
import { GAMES } from '../../games.js';
import { Button, Choice, CoinIcon, GemIcon, Icon, Toggle } from '../../kit/index.js';
import styles from './MotionLab.module.css';

const LEVELS = [
  { value: 'high', label: 'Cao' },
  { value: 'low', label: 'Thấp' },
];

const PLAYERS = [
  { name: 'Minh', avatar: avatarCat, speed: 9 },
  { name: 'Lan', avatar: avatarFox, speed: 5 },
  { name: 'Máy 1', avatar: avatarBot, speed: 14 },
];

const BADGE_DELAY = 300;

/** Closes a top-layer `<dialog>` after its exit transition; Safari and Firefox cannot animate `display` out. */
async function closeAnimated(dialog: HTMLDialogElement) {
  dialog.setAttribute('data-closing', '');
  const running = dialog.getAnimations({ subtree: true });
  await Promise.race([
    Promise.allSettled(running.map((a) => a.finished)),
    new Promise((resolve) => setTimeout(resolve, 600)),
  ]);
  dialog.removeAttribute('data-closing');
  dialog.close();
}

function LabDialog({
  open,
  onClose,
  className,
  onKeyDown,
  children,
}: {
  open: boolean;
  onClose(): void;
  className: string;
  onKeyDown?(e: KeyboardEvent<HTMLDialogElement>): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) void closeAnimated(dialog);
  }, [open]);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a tap on the backdrop is a pointer shortcut; Escape closes too
    <dialog
      ref={ref}
      className={className}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function SignalIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      className={styles.signal}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={3 + i * 5}
          y={18 - i * 4}
          width={3}
          height={3 + i * 4}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </svg>
  );
}

function Diamond({ size = 24 }: { size?: number }) {
  return (
    <span className={styles.diamond} style={{ '--size': `${size}px` } as CSSProperties}>
      <span />
      <span />
    </span>
  );
}

/** The four looping HUD icons, each with the name it is reviewed under. */
function LoopIcons() {
  return (
    <ul className={styles.legend}>
      <li>
        <span className={styles.signalWrap}>
          <SignalIcon />
        </span>
        Kết nối
      </li>
      <li>
        <span className={`${styles.swing} ${styles.loop}`}>
          <Icon icon={IconBell} size={24} />
        </span>
        Chuông
      </li>
      <li>
        <span className={styles.online}>
          <span className={styles.loop} />
        </span>
        Trực tuyến
      </li>
      <li>
        <span className={`${styles.glint} ${styles.loopAfter}`}>
          <CoinIcon size={24} />
        </span>
        Xu
      </li>
      <li>
        <Diamond />
        Đồng bộ
      </li>
      <li>
        <span className={`${styles.bob} ${styles.loop}`}>
          <Icon icon={IconMail} size={24} />
          <i className={styles.pip} />
        </span>
        Thư mời
      </li>
    </ul>
  );
}

function CaroEmblem() {
  return (
    <svg viewBox="0 0 64 64" width={64} height={64} aria-hidden="true">
      <path
        d="M16 16 30 30M30 16 16 30"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
      />
      <circle cx="41" cy="41" r="8" fill="none" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}

function Emblem({ children }: { children: ReactNode }) {
  return (
    <div className={styles.emblem}>
      <span className={`${styles.ring} ${styles.loop}`} />
      <span className={styles.plate}>{children}</span>
    </div>
  );
}

/** The match loading screen (the Game's Emblem, a bar and each player's load) or the way back to the Harbour (the Hub's Emblem). */
function Loading({ kind, onDone }: { kind: 'match' | 'harbour'; onDone(): void }) {
  const [tick, setTick] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const loads = PLAYERS.map((p) => Math.min(100, tick * p.speed));
  const total = kind === 'match' ? Math.min(...loads) : Math.min(100, tick * 8);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 220);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (total < 100 || leaving) return;
    const hold = setTimeout(() => setLeaving(true), 700);
    return () => clearTimeout(hold);
  }, [total, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const out = setTimeout(onDone, 260);
    return () => clearTimeout(out);
  }, [leaving, onDone]);

  return (
    <div
      className={`${styles.loading} ${leaving ? styles.leaving : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className={`${styles.stripes} ${styles.loop}`} aria-hidden="true" />
      <Emblem>{kind === 'match' ? <CaroEmblem /> : <Icon icon={IconAnchor} size={64} />}</Emblem>
      <div className={styles.loadInfo}>
        <span className={styles.kicker}>{kind === 'match' ? 'Đang tải ván' : 'Đang về'}</span>
        <h2 className={styles.title}>{kind === 'match' ? 'Caro' : 'Bến'}</h2>
        <progress className={styles.bar} max={100} value={total} />
        <span className={styles.percent}>{total}%</span>
        {kind === 'match' && (
          <ul className={styles.players}>
            {PLAYERS.map((p, i) => (
              <li key={p.name}>
                <img src={p.avatar} alt="" />
                <span>{p.name}</span>
                <span className={loads[i] === 100 ? styles.ready : styles.dim}>
                  {loads[i] === 100 ? 'Xong' : `${loads[i]}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const PAGES: { title: string; body(art?: string): ReactNode }[] = [
  {
    title: 'Luật chơi',
    body: () => (
      <>
        <p>
          Hai người lần lượt đặt quân X và O lên bàn. Ai có năm quân liền nhau theo hàng ngang, hàng
          dọc hoặc đường chéo trước thì thắng.
        </p>
        <p>
          Người cầm X đi trước. Mỗi lượt chỉ được đặt một quân vào một ô trống, và quân đã đặt thì
          không đi lại được.
        </p>
        <p>
          Nếu bàn kín mà chưa ai có năm quân liền nhau, ván hoà. Hết giờ mà chưa đặt quân thì mất
          lượt.
        </p>
      </>
    ),
  },
  {
    title: 'Một lượt',
    body: () => (
      <ol className={styles.steps}>
        <li>Chờ tới lượt mình: tên bạn sáng lên.</li>
        <li>Chạm vào một ô trống để đặt quân.</li>
        <li>Chạm lần nữa để xác nhận.</li>
        <li>Đồng hồ của đối thủ bắt đầu chạy.</li>
      </ol>
    ),
  },
  {
    title: 'Bàn cờ',
    body: (art) => (
      <figure className={styles.figure}>
        {art ? <img src={art} alt="" /> : <span />}
        <figcaption>Bàn 15 × 15, ô giữa có dấu chấm.</figcaption>
      </figure>
    ),
  },
  {
    title: 'Tính điểm',
    body: () => (
      <ul className={styles.scores}>
        {PLAYERS.map((p, i) => (
          <li key={p.name}>
            <img src={p.avatar} alt="" />
            <span>{p.name}</span>
            <span>{['+3', '+1', '0'][i]}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    title: 'Mẹo',
    body: () => (
      <p>
        Chặn ngay khi đối thủ có ba quân liền nhau và hai đầu còn trống: để tới bốn thì đã muộn.
      </p>
    ),
  },
];

function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 32 64" width={32} height={64} aria-hidden="true">
      <path
        d="M23 8 9 32l14 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The pager overlay: pages on a swipeable snap track inside one glass panel, the HUD's band left clear. */
function Pager({ open, onClose, art }: { open: boolean; onClose(): void; art?: string }) {
  const [page, setPage] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const last = PAGES.length - 1;

  useEffect(() => {
    if (!open || !track.current) return;
    track.current.scrollLeft = 0;
    setPage(0);
  }, [open]);

  const go = (to: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(last, to));
    const still =
      el.closest('[data-reduce]') !== null ||
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: n * el.clientWidth, behavior: still ? 'instant' : 'smooth' });
  };

  return (
    <LabDialog
      open={open}
      onClose={onClose}
      className={styles.pager ?? ''}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(page - 1);
        else if (e.key === 'ArrowRight') go(page + 1);
        else return;
        e.preventDefault();
      }}
    >
      <div className={styles.pagerMain}>
        <button
          type="button"
          className={styles.nav}
          aria-label="Trang trước"
          disabled={page === 0}
          onClick={() => go(page - 1)}
        >
          <Chevron />
        </button>
        <div className={`${styles.pagerPanel} ${styles.glass} cut-br`}>
          <header className={styles.sheetTop}>
            <h2>{PAGES[page]?.title}</h2>
            <span className={styles.count}>
              {page + 1} / {PAGES.length}
            </span>
            <button type="button" className={styles.close} aria-label="Đóng" onClick={onClose}>
              <Icon icon={IconX} size={28} />
            </button>
          </header>
          <div
            ref={track}
            className={styles.track}
            onScroll={(e) =>
              setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
            }
          >
            {PAGES.map((p, i) => (
              <section
                key={p.title}
                className={styles.page}
                data-active={i === page || undefined}
                aria-label={p.title}
                aria-hidden={i !== page}
              >
                {p.body(art)}
              </section>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={styles.nav}
          aria-label="Trang sau"
          disabled={page === last}
          onClick={() => go(page + 1)}
        >
          <Chevron />
        </button>
      </div>
      <div className={styles.dots} aria-hidden="true">
        {PAGES.map((p, i) => (
          <span key={p.title} className={styles.dot} data-active={i === page || undefined} />
        ))}
      </div>
    </LabDialog>
  );
}

/** On touch, a press plays the sheen and underline a mouse gets on hover. */
function pressFlash(e: PointerEvent<HTMLElement>) {
  if (e.pointerType === 'mouse') return;
  const button = (e.target as Element).closest<HTMLElement>(`.${styles.alive}`);
  if (!button || button.matches(':disabled')) return;
  const lab = e.currentTarget;
  const still =
    lab.hasAttribute('data-reduce') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  button.animate(
    [
      { scale: '0 1' },
      { scale: '1 1', offset: 0.3 },
      { scale: '1 1', offset: 0.7 },
      { scale: '0 1' },
    ],
    {
      duration: 600,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      pseudoElement: '::after',
    },
  );
  if (still || button.classList.contains(styles.go ?? '')) return;
  button.animate([{ translate: '-150% 0' }, { translate: '350% 0' }], {
    duration: 520,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    pseudoElement: '::before',
  });
}

/**
 * Prototype for issue #295: the kit's motion, glass, looping HUD icons and the three ways to wait,
 * over a Game's art. Not used outside `/dev/kit`.
 */
export function MotionLab({ full }: { full?: boolean }) {
  const [level, setLevel] = useState('high');
  const [reduce, setReduce] = useState(false);
  const [dialog, setDialog] = useState<'notify' | 'confirm' | 'band' | null>(null);
  const [pager, setPager] = useState(false);
  const [sheet, setSheet] = useState<'friends' | 'settings' | null>(null);
  const [wait, setWait] = useState<{ blocking: boolean; shown: boolean } | null>(null);
  const [loading, setLoading] = useState<'match' | 'harbour' | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const art = (GAMES.find((g) => g.manifest.id === 'caro') ?? GAMES[0])?.art.lobby;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** A request that takes `ms`: the badge shows only once it has waited `BADGE_DELAY`. */
  const request = (ms: number, blocking: boolean) => {
    timers.current.forEach(clearTimeout);
    setWait({ blocking, shown: false });
    timers.current = [
      setTimeout(() => setWait({ blocking, shown: true }), BADGE_DELAY),
      setTimeout(() => setWait(null), ms),
    ];
  };

  return (
    <section
      className={`${styles.lab} ${full ? styles.full : ''}`}
      data-graphics={level}
      data-reduce={reduce || undefined}
      aria-label="Chuyển động và kính mờ"
      onPointerDown={pressFlash}
    >
      {art && <img className={styles.art} src={art} alt="" />}

      <header className={`${styles.hud} ${styles.glass} cut-br`}>
        <span className={styles.who}>
          <img src={avatarCat} alt="" />
          Minh
          <span className={styles.online}>
            <span className={styles.loop} />
          </span>
        </span>
        <span className={styles.money}>
          <span className={styles.amount}>
            <span className={`${styles.glint} ${styles.loopAfter}`}>
              <CoinIcon size={26} />
            </span>
            1 250
          </span>
          <span className={styles.amount}>
            <GemIcon size={26} />
            40
          </span>
        </span>
        <span className={styles.tools}>
          <span className={styles.tool}>
            <SignalIcon size={28} />
          </span>
          <button type="button" className={styles.tool} aria-label="Thông báo">
            <span className={`${styles.swing} ${styles.loop}`}>
              <Icon icon={IconBell} size={28} />
            </span>
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label="Thư mời"
            onClick={() => setSheet('friends')}
          >
            <span className={`${styles.bob} ${styles.loop}`}>
              <Icon icon={IconMail} size={28} />
              <i className={styles.pip} />
            </span>
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label="Đồ hoạ"
            onClick={() => setSheet('settings')}
          >
            <Icon icon={IconSettings} size={28} />
          </button>
        </span>
      </header>

      <div className={styles.panels}>
        <div className={`${styles.panel} ${styles.glass} cut-br`}>
          <span className={styles.label}>Nút</span>
          <Button variant="primary" className={`${styles.alive} ${styles.go}`}>
            Ra khơi
            <span className={styles.chevrons} aria-hidden="true">
              <IconChevronRight size={24} stroke={3} />
              <IconChevronRight size={24} stroke={3} />
              <IconChevronRight size={24} stroke={3} />
            </span>
          </Button>
          <div className={`${styles.row} ${styles.even}`}>
            <Button className={styles.alive} onClick={() => setLoading('match')}>
              Tải ván
            </Button>
            <Button variant="ghost" className={styles.alive} onClick={() => setLoading('harbour')}>
              Về Bến
            </Button>
            <Button className={styles.alive} disabled>
              Khoá
            </Button>
          </div>
          <LoopIcons />
        </div>

        <div className={`${styles.panel} ${styles.glass} cut-br`}>
          <div className={styles.group}>
            <span className={styles.label}>Hộp thoại</span>
            <div className={styles.row}>
              <Button className={styles.alive} onClick={() => setDialog('notify')}>
                Báo
              </Button>
              <Button className={styles.alive} onClick={() => setDialog('confirm')}>
                Hỏi
              </Button>
              <Button className={styles.alive} onClick={() => setDialog('band')}>
                Dải ngang
              </Button>
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.label}>Lớp phủ</span>
            <div className={styles.row}>
              <Button className={styles.alive} onClick={() => setSheet('friends')}>
                Sheet
              </Button>
              <Button className={styles.alive} onClick={() => setPager(true)}>
                Trang
              </Button>
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.label}>Chờ</span>
            <div className={styles.row}>
              <Button className={styles.alive} onClick={() => request(200, false)}>
                0,2 giây
              </Button>
              <Button className={styles.alive} onClick={() => request(2500, false)}>
                Tải nền
              </Button>
              <Button className={styles.alive} onClick={() => request(2500, true)}>
                Vào phòng
              </Button>
            </div>
          </div>
        </div>
      </div>

      {wait?.blocking && <div className={styles.scrim} />}
      {wait?.shown && (
        <div className={`${styles.badge} ${styles.glass}`} role="status">
          <span className={styles.rule} aria-hidden="true" />
          <Diamond size={22} />
          <span className={styles.badgeText}>Đang tải</span>
          <span className={styles.mirror}>
            <Diamond size={22} />
          </span>
          <span className={styles.rule} aria-hidden="true" />
        </div>
      )}

      <Pager open={pager} onClose={() => setPager(false)} art={art} />

      {loading && <Loading kind={loading} onDone={() => setLoading(null)} />}

      <LabDialog
        open={dialog === 'notify'}
        onClose={() => setDialog(null)}
        className={`${styles.box} ${styles.glass} cut-br`}
      >
        <h2>Đã gửi lời mời</h2>
        <p>Lan sẽ thấy lời mời khi vào Bến.</p>
        <div className={styles.actions}>
          <Button variant="primary" className={styles.alive} onClick={() => setDialog(null)}>
            Đã hiểu
          </Button>
        </div>
      </LabDialog>

      <LabDialog
        open={dialog === 'confirm'}
        onClose={() => setDialog(null)}
        className={`${styles.box} ${styles.glass} cut-br`}
      >
        <h2>Rời ván?</h2>
        <p>Bạn sẽ bị tính hạng chót.</p>
        <div className={styles.actions}>
          <Button className={styles.alive} onClick={() => setDialog(null)}>
            Ở lại
          </Button>
          <Button variant="primary" className={styles.alive} onClick={() => setDialog(null)}>
            Rời
          </Button>
        </div>
      </LabDialog>

      <LabDialog
        open={dialog === 'band'}
        onClose={() => setDialog(null)}
        className={`${styles.band} ${styles.glass}`}
      >
        <div className={styles.bandInner}>
          <span className={styles.kicker}>Xác nhận</span>
          <h2>Rời ván?</h2>
          <p>Bạn sẽ bị tính hạng chót.</p>
          <div className={styles.actions}>
            <Button variant="ghost" className={styles.alive} onClick={() => setDialog(null)}>
              Ở lại
            </Button>
            <Button variant="primary" className={styles.alive} onClick={() => setDialog(null)}>
              Rời
            </Button>
          </div>
        </div>
      </LabDialog>

      <LabDialog
        open={sheet === 'friends'}
        onClose={() => setSheet(null)}
        className={`${styles.sheet} ${styles.glass}`}
      >
        <header className={styles.sheetTop}>
          <h2>Hàng xóm</h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Đóng"
            onClick={() => setSheet(null)}
          >
            <Icon icon={IconX} size={28} />
          </button>
        </header>
        <ul className={styles.friends}>
          {PLAYERS.map((p, i) => (
            <li key={p.name} style={{ '--i': i } as CSSProperties}>
              <img src={p.avatar} alt="" />
              {p.name}
              {i === 0 && (
                <span className={styles.online}>
                  <span className={styles.loop} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </LabDialog>

      <LabDialog
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
        className={`${styles.sheet} ${styles.glass}`}
      >
        <header className={styles.sheetTop}>
          <h2>Đồ hoạ</h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Đóng"
            onClick={() => setSheet(null)}
          >
            <Icon icon={IconX} size={28} />
          </button>
        </header>
        <div className={styles.settings}>
          <Choice label="Mức" options={LEVELS} value={level} onChange={setLevel} />
          <Toggle label="Giảm chuyển động" checked={reduce} onChange={setReduce} />
        </div>
      </LabDialog>
    </section>
  );
}
