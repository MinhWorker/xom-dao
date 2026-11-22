import { IconBook2, IconChevronLeft, IconLock } from '@tabler/icons-react';
import type { Island } from '@xomdao/sdk';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { GAMES, type HubGame, SOON_GAMES } from '../../games.js';
import { type HubIsland, ISLANDS } from '../../islands.js';
import { Button, Chip, Icon } from '../../kit/index.js';
import { rovingKeyDown } from '../../kit/roving.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate } from '../../router.js';
import { prefersReducedMotion } from '../../settings/graphics.js';
import { hoverSound, playSound } from '../../sound/index.js';
import { tilt, untilt } from '../kit/GameTiles.js';
import { RulesPager } from '../rules/RulesPager.js';
import { type ChartCard, islandCards } from './chart.js';
import styles from './SeaChart.module.css';
import { durationLabel, focusPosition, playersLabel } from './summary.js';

const CODES: Record<Island, string> = { co: 'CO', bai: 'BA', 'xuc-xac': 'XX', 'nao-nhiet': 'NN' };

/** Each Island's hue for its accents. */
const HUES: Record<Island, number> = { co: 196, bai: 352, 'xuc-xac': 150, 'nao-nhiet': 24 };

const cardsOf = (island: HubIsland) => islandCards(island.id, GAMES, SOON_GAMES, island.art);

/** Where the player was on the chart, so coming back from a Room shows the same card. */
const last = { island: ISLANDS[0]?.id ?? ('co' as Island), card: '' };

/** The id of the card focused last on the chart, `''` before the chart was opened. */
export const lastCardId = () => last.card;

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

/** The scroll offset that puts a card on the track's snap line. */
function offsetOf(track: HTMLElement, index: number): number {
  const card = track.children[index] as HTMLElement | undefined;
  const padding = Number.parseFloat(getComputedStyle(track).scrollPaddingLeft || '0');
  return card ? card.offsetLeft - padding : 0;
}

/** The card nearest the snap line. */
function snappedIndex(track: HTMLElement): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < track.children.length; index++) {
    const distance = Math.abs(offsetOf(track, index) - track.scrollLeft);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

/** The first card that cannot go past the snap line: it and every card after it stay on screen. */
function tailStart(track: HTMLElement): number {
  const max = track.scrollWidth - track.clientWidth;
  for (let index = 0; index < track.children.length; index++) {
    if (offsetOf(track, index) >= max - 1) return index;
  }
  return Math.max(0, track.children.length - 1);
}

function scrollToCard(track: HTMLElement | null, index: number, instant = false) {
  if (!track) return;
  track.scrollTo({
    left: offsetOf(track, index),
    behavior: instant || prefersReducedMotion() ? 'instant' : 'smooth',
  });
}

/**
 * The track of Game cards: scroll-snaps one card at a time and reports the focused card. Cards in
 * the tail cannot reach the snap line, so there the focus is the last one picked, not read from the scroll.
 */
function useSnapTrack(
  scope: string,
  count: number,
  start: number,
  onFocus: (index: number) => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const focusRef = useRef(start);
  const lockRef = useRef({ index: start, until: 0 });

  const focusOn = useCallback(
    (index: number) => {
      if (index === focusRef.current) return;
      focusRef.current = index;
      onFocus(index);
    },
    [onFocus],
  );

  /** Focuses a card and scrolls to it; scroll events are ignored until the scroll has settled. */
  const select = useCallback(
    (index: number, instant = false) => {
      const target = Math.max(0, Math.min(count - 1, index));
      lockRef.current = { index: target, until: performance.now() + 500 };
      focusOn(target);
      scrollToCard(ref.current, target, instant);
    },
    [count, focusOn],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: `scope` remounts the track, so listeners rebind
  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    if (focusRef.current > 0) scrollToCard(track, focusRef.current, true);
    let frame = 0;
    const sync = () => {
      frame = 0;
      const lock = lockRef.current;
      if (performance.now() < lock.until) {
        focusOn(lock.index);
        return;
      }
      const tail = tailStart(track);
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
      focusOn(atEnd ? Math.max(tail, focusRef.current) : snappedIndex(track));
    };
    const onScroll = () => {
      const lock = lockRef.current;
      const now = performance.now();
      if (now < lock.until) lock.until = Math.max(lock.until, now + 150);
      if (!frame) frame = requestAnimationFrame(sync);
    };
    let lastStep = 0;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastStep < 280) return;
      lastStep = now;
      select(focusRef.current + Math.sign(event.deltaY));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('wheel', onWheel);
    };
  }, [scope, focusOn, select]);

  return { ref, focusRef, lockRef, select };
}

function Splash({ card, on }: { card: ChartCard; on: boolean }) {
  return (
    <div className={styles.splash} data-on={on || undefined} data-soon={!card.game || undefined}>
      <img
        src={card.splash}
        alt=""
        decoding="async"
        style={card.game ? { objectPosition: focusPosition(card.game.manifest) } : undefined}
      />
    </div>
  );
}

/**
 * `/sea`: the Sea chart, after Arknights' stage select. Islands in a column, the Island's Games as
 * glass cards on a track that snaps one card at a time; the focused card grows and the screen's art
 * follows it. "Ra khơi" makes a Room of that Game; Escape goes back to the Bến.
 */
export function SeaChart() {
  const closedReason = useHub((s) => s.closed);
  const [islandId, setIslandId] = useState<Island>(last.island);
  const island = ISLANDS.find((i) => i.id === islandId) ?? (ISLANDS[0] as HubIsland);
  const cards = cardsOf(island);
  const [focus, setFocus] = useState(() =>
    Math.max(
      0,
      cards.findIndex((c) => c.id === last.card),
    ),
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [running, setRunning] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = cards[focus] ?? cards[0];

  useEffect(() => {
    void hub.gameIds().then(setRunning);
  }, []);

  useEffect(() => {
    last.island = island.id;
    last.card = current?.id ?? '';
  }, [island.id, current?.id]);

  const onFocus = useCallback((index: number) => {
    setFocus(index);
    setError('');
    playSound('cardHover');
  }, []);
  const {
    ref: track,
    focusRef,
    lockRef,
    select,
  } = useSnapTrack(island.id, cards.length, focus, onFocus);

  const pickIsland = (id: Island) => {
    if (id === islandId) return;
    playSound('pick');
    setIslandId(id);
    setFocus(0);
    setError('');
    focusRef.current = 0;
    lockRef.current = { index: 0, until: 0 };
    track.current?.scrollTo({ left: 0, behavior: 'instant' });
  };

  const game = current?.game;
  const off = !!game && !!running && !running.includes(game.manifest.id);
  const canSail = !!game && !off && !busy;
  const hasRules = !!game && game.rules.length > 0;

  async function sail(target: HubGame) {
    playSound('pick');
    setBusy(true);
    setError('');
    try {
      const { roomCode } = await hub.request('room:create', {
        gameId: target.manifest.id,
        version: target.version,
      });
      navigate(`/room/${roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Máy chủ gặp lỗi');
    } finally {
      setBusy(false);
    }
  }

  const message = error || closedReason;

  useEffect(() => {
    if (rulesOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) navigate('/');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [rulesOpen]);

  return (
    <main className={styles.chart} style={{ '--hue': HUES[island.id] } as CSSProperties}>
      <div className={styles.backdrop} aria-hidden="true" key={island.id}>
        {cards.map((card, index) => (
          <Splash key={card.id} card={card} on={index === focus} />
        ))}
      </div>

      <header className={styles.top}>
        <button
          type="button"
          className={styles.back}
          aria-label="Về Bến"
          onPointerEnter={(e) => hoverSound(e)}
          onClick={() => {
            playSound('click');
            navigate('/');
          }}
        >
          <Icon icon={IconChevronLeft} />
        </button>
        <h1 className={styles.title}>
          <span className={styles.kicker}>Bến</span>
          Hải đồ
        </h1>
      </header>

      <nav className={styles.islands} aria-label="Đảo">
        <ul onKeyDown={(e) => rovingKeyDown(e, 'button')}>
          {ISLANDS.map((item, index) => {
            const on = item.id === island.id;
            const islandList = cardsOf(item);
            const made = islandList.filter((c) => c.game).length;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={styles.island}
                  aria-current={on || undefined}
                  aria-label={`Đảo ${item.name}`}
                  tabIndex={on ? 0 : -1}
                  onPointerEnter={(e) => hoverSound(e)}
                  onClick={() => pickIsland(item.id)}
                >
                  <span className={styles.islandNo}>{pad(index + 1)}</span>
                  <Svg markup={item.emblem} className={styles.islandEmblem} />
                  <span className={styles.islandName}>{item.name}</span>
                  <span className={styles.islandCount}>
                    {made}/{islandList.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className={styles.stage} aria-label={`Đảo ${island.name}`}>
        {current ? (
          <div className={styles.info} key={current.id}>
            <p className={styles.code}>
              {CODES[island.id]}-{pad(focus + 1)}
              <span className={styles.count}>
                {pad(focus + 1)} / {pad(cards.length)}
              </span>
            </p>
            <h2 className={styles.name}>{current.name}</h2>
            <div className={styles.facts}>
              {game ? (
                <>
                  <Chip>{playersLabel(game.manifest)}</Chip>
                  <Chip>{durationLabel(game.manifest)}</Chip>
                  {game.manifest.bots && <Chip>Có máy</Chip>}
                  {game.manifest.status === 'wip' && <Chip tone="accent">Đang làm</Chip>}
                  {off && <Chip tone="danger">Tạm đóng</Chip>}
                </>
              ) : (
                <Chip>Sắp có</Chip>
              )}
              <Button
                variant="primary"
                forward={!!game}
                disabled={!canSail}
                className={styles.go}
                onClick={() => game && void sail(game)}
              >
                {game ? 'Ra khơi' : 'Chưa mở'}
              </Button>
              {hasRules && (
                <Button
                  variant="ghost"
                  className={styles.rules}
                  aria-label={`Luật chơi ${current.name}`}
                  onClick={() => setRulesOpen(true)}
                >
                  <IconBook2 stroke={2} aria-hidden />
                </Button>
              )}
            </div>
            {message && (
              <p className={styles.error} role="alert">
                {message}
              </p>
            )}
          </div>
        ) : (
          <p className={styles.empty}>Chưa có trò nào.</p>
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
            select(next);
            (track.current?.children[next] as HTMLElement | undefined)?.focus({
              preventScroll: true,
            });
          }}
        >
          {cards.map((card, index) => {
            const on = index === focus;
            const locked = !card.game;
            return (
              <button
                key={card.id}
                type="button"
                className={styles.card}
                style={{ '--i': index } as CSSProperties}
                data-on={on || undefined}
                data-soon={locked || undefined}
                aria-current={on || undefined}
                aria-label={card.name}
                tabIndex={on ? 0 : -1}
                onPointerEnter={(e) => hoverSound(e, 'cardHover')}
                onPointerMove={tilt}
                onPointerLeave={untilt}
                onClick={() => {
                  if (!on) select(index);
                  else playSound(card.game ? 'pick' : 'locked');
                }}
              >
                <span className={styles.face}>
                  <span className={styles.depth}>
                    <span className={styles.stack} data-loop={on || undefined}>
                      <span className={styles.glassBack} />
                      <span className={styles.glassMid}>
                        {card.picture && <img src={card.picture} alt="" decoding="async" />}
                        <Svg markup={card.emblem} className={styles.cardEmblem} />
                        <span className={styles.cardCode}>
                          {CODES[island.id]}-{pad(index + 1)}
                        </span>
                      </span>
                      <span className={styles.glassFront} />
                    </span>
                    {locked && (
                      <span className={styles.lock}>
                        <Icon icon={IconLock} size={20} />
                      </span>
                    )}
                  </span>
                  <span className={styles.cardName}>{card.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      {rulesOpen && game && <RulesPager game={game} onClose={() => setRulesOpen(false)} />}
    </main>
  );
}
