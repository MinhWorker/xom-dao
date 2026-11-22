import { IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { HubGame, RulesBlock, RulesPage } from '../../games.js';
import { closeAnimated } from '../../kit/modal.js';
import { focusPosition } from '../sea/summary.js';
import { parseInline } from './inline.js';
import { nearestPage, pageLabel } from './pager.js';
import styles from './RulesPager.module.css';

/** After the last scroll event, how long to wait before calling the scroll settled (no `scrollend`). */
const SETTLE_FALLBACK_MS = 120;

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

function Inline({ text }: { text: string }) {
  return parseInline(text).map((part) => {
    if (part.kind === 'strong') return <strong key={part.at}>{part.text}</strong>;
    if (part.kind === 'em') return <em key={part.at}>{part.text}</em>;
    if (part.kind === 'code') return <code key={part.at}>{part.text}</code>;
    return <span key={part.at}>{part.text}</span>;
  });
}

function Block({ block }: { block: RulesBlock }) {
  if (block.kind === 'text') {
    return (
      <p>
        <Inline text={block.text} />
      </p>
    );
  }
  if (block.kind === 'list') {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          {block.head.map((cell) => (
            <th key={cell} scope="col">
              <Inline text={cell} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row) => (
          <tr key={row.join('|')}>
            {row.map((cell) => (
              <td key={cell}>
                <Inline text={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Slide({
  page,
  index,
  count,
  game,
  active,
}: {
  page: RulesPage;
  index: number;
  count: number;
  game: HubGame;
  active: boolean;
}) {
  return (
    <section
      className={styles.slide}
      data-active={active || undefined}
      aria-roledescription="trang"
      aria-label={pageLabel(index, count)}
    >
      <div className={styles.media}>
        {page.image ? (
          <img src={page.image.url} alt={page.image.alt} />
        ) : (
          <>
            <img
              src={game.art.card}
              alt=""
              style={{ objectPosition: focusPosition(game.manifest) }}
            />
            <span className={styles.numeral} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
          </>
        )}
      </div>
      <div className={styles.text}>
        <h3>{page.title}</h3>
        {page.blocks.map((block, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are static positions
          <Block key={i} block={block} />
        ))}
      </div>
    </section>
  );
}

export interface RulesPagerProps {
  game: HubGame;
  /** Escape or the close button: the pager asks to close. */
  onClose(): void;
}

/**
 * A Game's rules as a full-screen modal: one page per `##` of its `RULES.md`, swiped (a native
 * scroll-snap track), stepped with the arrows or jumped to with the dots. Mount it to open it.
 */
export function RulesPager({ game, onClose }: RulesPagerProps) {
  const pages = game.rules;
  const count = pages.length;
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const pending = useRef<number | null>(null);
  const settled = useRef(0);
  const frame = useRef(0);
  const timer = useRef(0);
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    track.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(timer.current);
    };
  }, []);

  const pageAt = () => {
    const el = track.current;
    return el ? nearestPage(el.scrollLeft, el.clientWidth, count) : 0;
  };

  const settle = () => {
    clearTimeout(timer.current);
    pending.current = null;
    const index = pageAt();
    setCurrent(index);
    if (index !== settled.current) {
      settled.current = index;
      setStatus(`${pages[index]?.title ?? ''}, trang ${pageLabel(index, count)}`);
    }
  };

  const onScroll = () => {
    if (window.onscrollend === undefined) {
      clearTimeout(timer.current);
      timer.current = window.setTimeout(settle, SETTLE_FALLBACK_MS);
    }
    if (pending.current !== null || frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pending.current === null) setCurrent(pageAt());
    });
  };

  const goTo = (target: number) => {
    const el = track.current;
    if (!el) return;
    const index = Math.min(count - 1, Math.max(0, target));
    pending.current = index;
    setCurrent(index);
    if (index === 0 && document.activeElement === previous.current) next.current?.focus();
    if (index === count - 1 && document.activeElement === next.current) previous.current?.focus();
    el.scrollTo({ left: index * el.clientWidth, behavior: 'auto' });
  };

  /** The exit plays and `close()` runs before unmounting, so the browser hands focus back to what opened the pager. */
  const close = () => {
    const el = dialog.current;
    if (!el?.open) return onClose();
    void closeAnimated(el).then(onClose);
  };

  const step = (delta: number) => goTo((pending.current ?? current) + delta);

  return (
    <dialog
      ref={dialog}
      className={styles.pager}
      aria-labelledby="rules-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className={styles.main}>
        <button
          ref={previous}
          type="button"
          className={styles.arrow}
          aria-label="Trang trước"
          hidden={count < 2}
          disabled={current === 0}
          onClick={() => step(-1)}
        >
          <Chevron />
        </button>
        <div className={`${styles.panel} glass cut-br`}>
          <header className={styles.top}>
            <h2 id="rules-title">
              <span className={styles.kicker}>Luật chơi</span>
              {game.manifest.name}
            </h2>
            {count > 1 && (
              <span className={styles.count} aria-hidden="true">
                {current + 1} / {count}
              </span>
            )}
            <button
              type="button"
              className={styles.close}
              aria-label="Đóng luật chơi"
              onClick={close}
            >
              <IconX size={28} stroke={2} aria-hidden />
            </button>
          </header>

          <section
            ref={track}
            className={styles.track}
            aria-roledescription="băng trang"
            aria-label={`Luật ${game.manifest.name}`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region takes focus so arrow keys page it
            tabIndex={0}
            onScroll={onScroll}
            onScrollEnd={settle}
          >
            {pages.map((page, i) => (
              <Slide
                key={page.title}
                page={page}
                index={i}
                count={count}
                game={game}
                active={i === current}
              />
            ))}
          </section>
        </div>
        <button
          ref={next}
          type="button"
          className={styles.arrow}
          aria-label="Trang sau"
          hidden={count < 2}
          disabled={current === count - 1}
          onClick={() => step(1)}
        >
          <Chevron />
        </button>
      </div>

      <nav className={styles.dots} aria-label="Chọn trang" hidden={count < 2}>
        {pages.map((page, i) => (
          <button
            key={page.title}
            type="button"
            className={styles.dot}
            aria-label={`${page.title}, trang ${pageLabel(i, count)}`}
            aria-current={i === current ? 'true' : undefined}
            onClick={() => goTo(i)}
          />
        ))}
      </nav>
      <p className={styles.status} role="status" aria-live="polite">
        {status}
      </p>
    </dialog>
  );
}
