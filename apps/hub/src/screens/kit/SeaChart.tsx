import { IconChevronLeft, IconLock } from '@tabler/icons-react';
import type { AnyManifest, Island } from '@xomdao/sdk';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { type HubIsland, ISLANDS } from '../../islands.js';
import { Button, Chip, Icon } from '../../kit/index.js';
import { rovingKeyDown } from '../../kit/roving.js';
import { prefersReducedMotion } from '../../settings/graphics.js';
import { hoverSound, playSound } from '../../sound/index.js';
import { durationLabel, playersLabel } from '../lobby/summary.js';
import styles from './SeaChart.module.css';

const manifests = import.meta.glob<AnyManifest>('../../../../../games/*/manifest.ts', {
  eager: true,
  import: 'default',
});
const emblems = import.meta.glob<string>('../../../../../games/*/hub/emblem.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const keyArts = import.meta.glob<string>('../../../../../games/*/hub/key-art.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const fileOf = (files: Record<string, string>, id: string) =>
  Object.entries(files).find(([path]) => path.split('/')[6] === id)?.[1];

interface ChartCard {
  manifest: AnyManifest;
  emblem: string;
  /** Stand-in splash art until the real ones are made: a Game's key art, or none (the Island's placeholder). */
  art?: string;
}

/** Every Game on an Island, made ones first, then by name. */
const cardsOf = (island: Island): ChartCard[] =>
  Object.values(manifests)
    .filter((m) => m.island === island)
    .sort(
      (a, b) =>
        Number(a.status === 'soon') - Number(b.status === 'soon') ||
        a.name.localeCompare(b.name, 'vi'),
    )
    .map((manifest) => ({
      manifest,
      emblem: fileOf(emblems, manifest.id) ?? '',
      art: manifest.status === 'soon' ? undefined : fileOf(keyArts, manifest.id),
    }));

const CODES: Record<Island, string> = { co: 'CO', bai: 'BA', 'xuc-xac': 'XX', 'nao-nhiet': 'NN' };

/** Each Island's hue for its stand-in art and accents. */
const HUES: Record<Island, number> = { co: 196, bai: 352, 'xuc-xac': 150, 'nao-nhiet': 24 };

const pad = (n: number) => String(n).padStart(2, '0');

function Svg({ markup, className }: { markup: string; className?: string }) {
  return (
    <span
      className={[styles.svg, className].filter(Boolean).join(' ')}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the repo's own SVG files, inlined so currentColor tints them
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** The card at the track's snap line: the one whose left edge is nearest the scroll padding. */
function snappedIndex(track: HTMLElement): number {
  const line =
    track.scrollLeft + Number.parseFloat(getComputedStyle(track).scrollPaddingLeft || '0');
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  [...track.children].forEach((card, index) => {
    const distance = Math.abs((card as HTMLElement).offsetLeft - line);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

function scrollToCard(track: HTMLElement | null, index: number) {
  const card = track?.children[index] as HTMLElement | undefined;
  if (!track || !card) return;
  const padding = Number.parseFloat(getComputedStyle(track).scrollPaddingLeft || '0');
  track.scrollTo({
    left: card.offsetLeft - padding,
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
  });
}

/** The track of Game cards: scroll-snaps one card at a time and reports the card at the snap line. */
function useSnapTrack(count: number, onFocus: (index: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const focusRef = useRef(0);

  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const index = snappedIndex(track);
      if (index === focusRef.current) return;
      focusRef.current = index;
      onFocus(index);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    let lastStep = 0;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastStep < 280) return;
      lastStep = now;
      const next = focusRef.current + Math.sign(event.deltaY);
      scrollToCard(track, Math.max(0, Math.min(count - 1, next)));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('wheel', onWheel);
    };
  }, [count, onFocus]);

  return { ref, focusRef };
}

function Splash({ card, island, on }: { card: ChartCard; island: HubIsland; on: boolean }) {
  const soon = card.manifest.status === 'soon';
  return (
    <div className={styles.splash} data-on={on || undefined} data-soon={soon || undefined}>
      {card.art ? (
        <img
          src={card.art}
          alt=""
          decoding="async"
          style={
            'focus' in card.manifest
              ? { objectPosition: `${card.manifest.focus.x}% ${card.manifest.focus.y}%` }
              : undefined
          }
        />
      ) : (
        <Svg markup={island.emblem} className={styles.watermark} />
      )}
    </div>
  );
}

/**
 * `/dev/kit#sea`, dev only: a throwaway prototype of the Sea chart for review (#306), after
 * Arknights' stage select. Islands in a column, the Island's Games on a track that snaps one card at
 * a time; the card at the snap line grows and the screen's art follows it. Splash art is a stand-in.
 */
export function SeaChart() {
  const [islandId, setIslandId] = useState<Island>(ISLANDS[0]?.id ?? 'co');
  const [focus, setFocus] = useState(0);
  const island = ISLANDS.find((i) => i.id === islandId) ?? (ISLANDS[0] as HubIsland);
  const cards = cardsOf(island.id);
  const current = cards[focus] ?? cards[0];

  const onFocus = useCallback((index: number) => {
    setFocus(index);
    playSound('cardHover');
  }, []);
  const { ref: track, focusRef } = useSnapTrack(cards.length, onFocus);

  const pickIsland = (id: Island) => {
    if (id === islandId) return;
    playSound('pick');
    setIslandId(id);
    setFocus(0);
    focusRef.current = 0;
    track.current?.scrollTo({ left: 0, behavior: 'instant' });
  };

  const soon = current?.manifest.status === 'soon';

  return (
    <main className={styles.chart} style={{ '--hue': HUES[island.id] } as CSSProperties}>
      <div className={styles.backdrop} aria-hidden="true" key={island.id}>
        {cards.map((card, index) => (
          <Splash key={card.manifest.id} card={card} island={island} on={index === focus} />
        ))}
      </div>

      <header className={styles.top}>
        <a className={styles.back} href="/dev/kit" aria-label="Về Bến">
          <Icon icon={IconChevronLeft} />
        </a>
        <h1 className={styles.title}>
          <span className={styles.kicker}>Bến</span>
          Hải đồ
        </h1>
      </header>

      <nav className={styles.islands} aria-label="Đảo">
        <ul onKeyDown={(e) => rovingKeyDown(e, 'button')}>
          {ISLANDS.map((item, index) => {
            const on = item.id === island.id;
            const made = cardsOf(item.id).filter((c) => c.manifest.status !== 'soon').length;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={styles.island}
                  aria-current={on || undefined}
                  tabIndex={on ? 0 : -1}
                  onPointerEnter={(e) => hoverSound(e)}
                  onClick={() => pickIsland(item.id)}
                >
                  <span className={styles.islandNo}>{pad(index + 1)}</span>
                  <Svg markup={item.emblem} className={styles.islandEmblem} />
                  <span className={styles.islandName}>{item.name}</span>
                  <span className={styles.islandCount}>
                    {made}/{cardsOf(item.id).length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className={styles.stage} aria-label={`Đảo ${island.name}`}>
        {current && (
          <div className={styles.info} key={current.manifest.id}>
            <p className={styles.code}>
              {CODES[island.id]}-{pad(focus + 1)}
              <span className={styles.count}>
                {pad(focus + 1)} / {pad(cards.length)}
              </span>
            </p>
            <h2 className={styles.name}>{current.manifest.name}</h2>
            <div className={styles.facts}>
              {current.manifest.status === 'soon' ? (
                <Chip>Sắp có</Chip>
              ) : (
                <>
                  <Chip>{playersLabel(current.manifest)}</Chip>
                  <Chip>{durationLabel(current.manifest)}</Chip>
                </>
              )}
              <Button variant="primary" forward={!soon} disabled={soon} className={styles.go}>
                {soon ? 'Chưa mở' : 'Ra khơi'}
              </Button>
            </div>
          </div>
        )}

        <div className={styles.route} aria-hidden="true" data-loop />
        <div
          ref={track}
          className={styles.track}
          key={island.id}
          role="toolbar"
          aria-label={`Trò của đảo ${island.name}`}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            const next = Math.max(0, Math.min(cards.length - 1, focus + step));
            scrollToCard(track.current, next);
            (track.current?.children[next] as HTMLElement | undefined)?.focus({
              preventScroll: true,
            });
          }}
        >
          {cards.map((card, index) => {
            const on = index === focus;
            const locked = card.manifest.status === 'soon';
            return (
              <button
                key={card.manifest.id}
                type="button"
                className={styles.card}
                style={{ '--i': index } as CSSProperties}
                data-on={on || undefined}
                data-soon={locked || undefined}
                aria-current={on || undefined}
                tabIndex={on ? 0 : -1}
                onPointerEnter={(e) => hoverSound(e, 'cardHover')}
                onClick={() => {
                  if (on) playSound(locked ? 'locked' : 'pick');
                  else scrollToCard(track.current, index);
                }}
              >
                <span className={styles.face}>
                  <span className={styles.cardArt}>
                    {card.art && <img src={card.art} alt="" decoding="async" />}
                  </span>
                  <span className={styles.cardCode}>
                    {CODES[island.id]}-{pad(index + 1)}
                  </span>
                  <Svg markup={card.emblem} className={styles.cardEmblem} />
                  <span className={styles.cardName}>{card.manifest.name}</span>
                  {locked && (
                    <span className={styles.lock}>
                      <Icon icon={IconLock} size={20} />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
