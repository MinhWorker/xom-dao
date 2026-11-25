import {
  IconArrowRight,
  IconBox,
  IconBuildingPavilion,
  IconBuildingStore,
  IconDoorEnter,
  IconEye,
  IconEyeOff,
  IconLock,
  IconPalette,
  IconSettings,
  IconTrophy,
  IconUsers,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import type { PlayerStats } from '@xomdao/shared/client';
import { type CSSProperties, type FormEvent, useEffect, useState } from 'react';
import { BACKGROUNDS, CHARACTERS, pickArt } from '../../harbour-art/arts.js';
import { HUB_EMBLEM, ISLANDS } from '../../islands.js';
import { Button, Dialog, Icon, Loop, OnlineDot, TextField, useFormReady } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate } from '../../router.js';
import { useHarbourLook } from '../../settings/harbour.js';
import { playSound } from '../../sound/index.js';
import { SoundToggle } from '../../sound/SoundToggle.js';
import { FriendsSheet } from '../friends/FriendsSheet.js';
import { onlineFriends } from '../friends/groups.js';
import { levelProgress } from '../profile/format.js';
import { SettingsOverlay } from '../settings/SettingsOverlay.js';
import styles from './Harbour.module.css';
import { HarbourLookOverlay } from './HarbourLook.js';
import { avatarSrc, frameSrc } from './portrait.js';

function Svg({ markup, className }: { markup: string; className?: string }) {
  return (
    <span
      className={[styles.svg, className].filter(Boolean).join(' ')}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the repo's own SVG files, inlined so currentColor tints them
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

interface LockedPanel {
  area: string;
  name: string;
  code: string;
  icon: TablerIcon;
  compact?: boolean;
}

const DINH: LockedPanel = {
  area: 'dinh',
  name: 'Đình',
  code: 'Sự kiện · Thư',
  icon: IconBuildingPavilion,
};

const BOTTOM_ROW: LockedPanel[] = [
  { area: 'cho', name: 'Chợ', code: 'Cửa hàng', icon: IconBuildingStore, compact: true },
  { area: 'kho', name: 'Kho', code: 'Kho đồ', icon: IconBox, compact: true },
  { area: 'bv', name: 'Bảng vàng', code: 'Thành tích', icon: IconTrophy },
];

/** A panel that is only a shell for now: dimmed, locked, not interactive. */
function Locked({ panel }: { panel: LockedPanel }) {
  return (
    <div
      className={`${styles.panel} ${styles.locked} glass cut-br`}
      style={{ gridArea: panel.area } as CSSProperties}
      data-compact={panel.compact || undefined}
      aria-disabled="true"
    >
      <span className={styles.lockedIcon}>
        <Icon icon={panel.icon} size={28} />
      </span>
      <span className={styles.lockedText}>
        <span className={styles.lockedName}>{panel.name}</span>
        <span className={styles.code}>{panel.code}</span>
      </span>
      <span className={styles.lock}>
        <Icon icon={IconLock} size={18} />
        <span className={styles.lockLabel}>Chưa mở</span>
      </span>
    </div>
  );
}

/** Your level, asked of the server each time the Bến opens; `null` until it answers. */
function useStats() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  useEffect(() => {
    let live = true;
    hub
      .request('stats:get', {})
      .then((reply) => live && setStats(reply))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return stats;
}

/** Nhà: who is at the Bến, with their level; opens their profile. */
function Home() {
  const user = useHub((s) => s.user);
  const stats = useStats();
  if (!user) return null;
  const label = stats ? `Nhà: ${user.name}, cấp ${stats.level}` : `Nhà: ${user.name}`;
  return (
    <button
      type="button"
      className={styles.home}
      aria-label={label}
      onClick={() => {
        playSound('click');
        navigate('/profile');
      }}
    >
      <span className={`${styles.homeShape} glass cut-br`} aria-hidden="true" />
      <span className={styles.portrait} aria-hidden="true">
        <img src={avatarSrc(user.avatar)} alt="" draggable={false} />
        <img src={frameSrc(user.frame)} alt="" draggable={false} />
      </span>
      <span className={styles.homeText}>
        <span className={styles.code}>Nhà</span>
        <span className={styles.homeName}>{user.name}</span>
      </span>
      {stats && (
        <span className={styles.homeLevel}>
          <span className={styles.levelHead}>
            <span className={styles.code}>Cấp</span>
            <span className={styles.levelNumber}>{stats.level}</span>
          </span>
          <span
            className={styles.exp}
            role="progressbar"
            aria-label="Kinh nghiệm"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(levelProgress(stats) * 100)}
          >
            <span className={styles.expFill} style={{ width: `${levelProgress(stats) * 100}%` }} />
          </span>
          <span className={styles.expText}>
            {stats.xp} / {stats.nextXp}
          </span>
        </span>
      )}
    </button>
  );
}

/**
 * The Bến at `/`: the player's Nhà, their character on the quay, and a tilted cluster of panels
 * leading to each function. Ra khơi opens the Sea chart; Đình, Chợ, Kho and Bảng vàng are locked shells.
 */
export function Harbour() {
  const closed = useHub((s) => s.closed);
  const friends = useHub((s) => s.friends);
  const requests = friends.filter((f) => f.state === 'incoming').length;
  const [neighbours, setNeighbours] = useState(false);
  const [settings, setSettings] = useState(false);
  const [look, setLook] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const { ready: codeReady, form: joinForm } = useFormReady();
  const picked = useHarbourLook();
  const character = pickArt(CHARACTERS, picked.character);
  const background = pickArt(BACKGROUNDS, picked.background);

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').replace(/\s/g, '');
    if (!code) return;
    setJoinOpen(false);
    navigate(`/room/${code.toUpperCase()}`);
  }

  return (
    <main className={styles.harbour} data-hud-hidden={hudHidden || undefined}>
      <div className={styles.backdrop} aria-hidden="true">
        <img
          className={styles.scene}
          src={background.src}
          style={{ objectPosition: background.position }}
          alt=""
          draggable={false}
        />
      </div>
      <img className={styles.character} src={character.src} alt="" draggable={false} />

      <header className={styles.top}>
        <Home />
      </header>

      <div className={styles.side}>
        <button
          type="button"
          className={`${styles.tool} glass cut-br`}
          aria-label="Tuỳ chỉnh Bến"
          onClick={() => {
            playSound('click');
            setLook(true);
          }}
        >
          <Icon icon={IconPalette} />
        </button>
        <SoundToggle className={`${styles.tool} glass cut-br`} />
        <button
          type="button"
          className={`${styles.tool} ${styles.eye} glass cut-br`}
          aria-label={hudHidden ? 'Hiện giao diện' : 'Ẩn giao diện'}
          aria-pressed={hudHidden}
          onClick={() => {
            playSound(hudHidden ? 'click' : 'close');
            setHudHidden(!hudHidden);
          }}
        >
          <Icon icon={hudHidden ? IconEyeOff : IconEye} />
        </button>
      </div>

      <div className={styles.title}>
        {closed && (
          <p className={styles.error} role="alert">
            {closed}
          </p>
        )}
        <span className={styles.code} aria-hidden="true">
          Xóm Đảo
        </span>
        <h1 className={styles.titleName}>Bến</h1>
      </div>

      <nav className={styles.cluster} aria-label="Bến">
        <div className={styles.tilt}>
          <Locked panel={DINH} />

          <button
            type="button"
            className={`${styles.panel} ${styles.small} glass cut-br`}
            style={{ gridArea: 'join' }}
            onClick={() => {
              playSound('click');
              setJoinOpen(true);
            }}
          >
            <Icon icon={IconDoorEnter} />
            <span className={styles.smallName}>Vào phòng</span>
          </button>

          <button
            type="button"
            className={`${styles.panel} ${styles.small} glass cut-br`}
            style={{ gridArea: 'set' }}
            onClick={() => {
              playSound('click');
              setSettings(true);
            }}
          >
            <Icon icon={IconSettings} />
            <span className={styles.smallName}>Cài đặt</span>
          </button>

          <button
            type="button"
            className={`${styles.panel} ${styles.go} cut-br`}
            style={{ gridArea: 'go' }}
            aria-label="Ra khơi"
            onClick={() => {
              playSound('click');
              navigate('/sea');
            }}
          >
            <Svg markup={HUB_EMBLEM} className={styles.goMark} />
            <span className={styles.goHead}>
              <span className={styles.code}>01 · Hải đồ</span>
              <span className={styles.goName}>Ra khơi</span>
            </span>
            <span className={styles.goFoot}>
              <span className={styles.islands}>
                {ISLANDS.map((island) => (
                  <Svg key={island.id} markup={island.emblem} className={styles.islandMark} />
                ))}
              </span>
              <span className={styles.goArrow}>
                <Icon icon={IconArrowRight} size={28} />
              </span>
            </span>
          </button>

          <button
            type="button"
            className={`${styles.panel} ${styles.tall} glass cut-br`}
            style={{ gridArea: 'nb' }}
            aria-label={requests > 0 ? `Hàng xóm, ${requests} lời mời` : 'Hàng xóm'}
            onClick={() => {
              playSound('click');
              setNeighbours(true);
            }}
          >
            <span className={styles.code}>02</span>
            <span className={styles.tallIcon}>
              <Loop kind="bob" active={requests > 0}>
                <Icon icon={IconUsers} size={32} />
              </Loop>
            </span>
            <span className={styles.tallName}>Hàng xóm</span>
            <span className={styles.online}>
              <OnlineDot />
              {onlineFriends(friends)}
            </span>
            {requests > 0 && <span className={styles.badge}>{requests}</span>}
          </button>

          {BOTTOM_ROW.map((panel) => (
            <Locked key={panel.area} panel={panel} />
          ))}
        </div>
      </nav>

      <FriendsSheet open={neighbours} onClose={() => setNeighbours(false)} />
      <SettingsOverlay open={settings} onClose={() => setSettings(false)} />
      <HarbourLookOverlay open={look} onClose={() => setLook(false)} />

      <Dialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Vào phòng"
        actions={
          <>
            <Button variant="ghost" sound="close" onClick={() => setJoinOpen(false)}>
              Huỷ
            </Button>
            <Button variant="primary" type="submit" form="join-room" disabled={!codeReady}>
              Vào
            </Button>
          </>
        }
      >
        <form {...joinForm} id="join-room" className={styles.join} onSubmit={join}>
          <TextField
            label="Mã phòng"
            name="code"
            className={styles.codeField}
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            required
          />
        </form>
      </Dialog>
    </main>
  );
}
