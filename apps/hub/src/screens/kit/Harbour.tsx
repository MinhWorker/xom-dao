import {
  IconArrowRight,
  IconBox,
  IconBuildingPavilion,
  IconBuildingStore,
  IconLock,
  IconSettings,
  IconTrophy,
  IconUsers,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import { type CSSProperties, useState } from 'react';
import { HUB_EMBLEM, ISLANDS } from '../../islands.js';
import { Icon, OnlineDot, Sheet } from '../../kit/index.js';
import { hoverSound, playSound } from '../../sound/index.js';
import { SettingsOverlay } from '../settings/SettingsOverlay.js';
import styles from './Harbour.module.css';

function Svg({ markup, className }: { markup: string; className?: string }) {
  return (
    <span
      className={[styles.svg, className].filter(Boolean).join(' ')}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the repo's own SVG files, inlined so currentColor tints them
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

const NEIGHBOURS = [
  { name: 'Lan', detail: 'Ở Bến', online: true },
  { name: 'Minh', detail: 'Đang chơi Caro', online: true },
  { name: 'Hải', detail: 'Ngoại tuyến', online: false },
];

interface LockedPanel {
  area: string;
  name: string;
  code: string;
  icon: TablerIcon;
  compact?: boolean;
}

const LOCKED: LockedPanel[] = [
  { area: 'dinh', name: 'Đình', code: 'Sự kiện · Thư', icon: IconBuildingPavilion },
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

/**
 * `/dev/kit#harbour`, dev only: a throwaway prototype of the Bến for review (#308), after Arknights'
 * lobby. The left half is left for art (a stand-in here); a tilted cluster of panels on the right
 * leads to each function. Chợ, Kho, Bảng vàng and Đình are locked shells.
 */
export function Harbour() {
  const [neighbours, setNeighbours] = useState(false);
  const [settings, setSettings] = useState(false);
  const online = NEIGHBOURS.filter((n) => n.online).length;

  return (
    <main className={styles.harbour}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.sun} />
        <div className={styles.sea} data-loop />
        <Svg markup={HUB_EMBLEM} className={styles.watermark} />
      </div>

      <header className={styles.top}>
        <button
          type="button"
          className={`${styles.home} glass cut-br`}
          onPointerEnter={(e) => hoverSound(e)}
          onClick={() => playSound('pick')}
        >
          <span className={styles.avatar} aria-hidden="true">
            M
          </span>
          <span className={styles.homeText}>
            <span className={styles.code}>Nhà · Cấp 12</span>
            <span className={styles.homeName}>Minh</span>
          </span>
        </button>
      </header>

      <div className={styles.title} aria-hidden="true">
        <span className={styles.code}>Xóm Đảo</span>
        <span className={styles.titleName}>Bến</span>
      </div>

      <nav className={styles.cluster} aria-label="Bến">
        <div className={styles.tilt}>
          <Locked panel={LOCKED[0] as LockedPanel} />

          <button
            type="button"
            className={`${styles.panel} ${styles.small} glass cut-br`}
            style={{ gridArea: 'set' }}
            onPointerEnter={(e) => hoverSound(e)}
            onClick={() => setSettings(true)}
          >
            <Icon icon={IconSettings} />
            <span className={styles.smallName}>Cài đặt</span>
          </button>

          <a
            className={`${styles.panel} ${styles.go} cut-br`}
            style={{ gridArea: 'go' }}
            href="/dev/kit#sea"
            onPointerEnter={(e) => hoverSound(e, 'cardHover')}
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
          </a>

          <button
            type="button"
            className={`${styles.panel} ${styles.tall} glass cut-br`}
            style={{ gridArea: 'nb' }}
            onPointerEnter={(e) => hoverSound(e)}
            onClick={() => setNeighbours(true)}
          >
            <span className={styles.code}>02</span>
            <span className={styles.tallIcon}>
              <Icon icon={IconUsers} size={32} />
            </span>
            <span className={styles.tallName}>Hàng xóm</span>
            <span className={styles.online}>
              <OnlineDot />
              {online}
            </span>
          </button>

          {LOCKED.slice(1).map((panel) => (
            <Locked key={panel.area} panel={panel} />
          ))}
        </div>
      </nav>

      <SettingsOverlay open={settings} onClose={() => setSettings(false)} />
      <Sheet open={neighbours} onClose={() => setNeighbours(false)} title="Hàng xóm">
        <ul className={styles.people}>
          {NEIGHBOURS.map((n) => (
            <li key={n.name} className={styles.person} data-dim={!n.online || undefined}>
              <span className={styles.avatar} aria-hidden="true">
                {n.name.slice(0, 1)}
              </span>
              <span className={styles.homeText}>
                <span className={styles.personName}>{n.name}</span>
                <span className={styles.personDetail}>
                  {n.online && <OnlineDot />} {n.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </main>
  );
}
