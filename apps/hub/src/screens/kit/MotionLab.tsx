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
  children,
}: {
  open: boolean;
  onClose(): void;
  className: string;
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
  const [dialog, setDialog] = useState<'box' | 'band' | null>(null);
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
            <Button className={styles.alive}>Hàng xóm</Button>
            <Button variant="ghost" className={styles.alive}>
              Rời
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
              <Button className={styles.alive} onClick={() => setDialog('box')}>
                Hộp
              </Button>
              <Button className={styles.alive} onClick={() => setDialog('band')}>
                Dải ngang
              </Button>
              <Button className={styles.alive} onClick={() => setSheet('friends')}>
                Sheet
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
          <div className={styles.group}>
            <span className={styles.label}>Màn tải</span>
            <div className={styles.row}>
              <Button className={styles.alive} onClick={() => setLoading('match')}>
                Tải ván
              </Button>
              <Button className={styles.alive} onClick={() => setLoading('harbour')}>
                Về Bến
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

      {loading && <Loading kind={loading} onDone={() => setLoading(null)} />}

      <LabDialog
        open={dialog === 'box'}
        onClose={() => setDialog(null)}
        className={`${styles.box} ${styles.glass} cut-br`}
      >
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
