import type { AnyManifest } from '@xomdao/sdk';
import { HUB_EMBLEM, ISLANDS } from '../../islands.js';
import { Emblem } from '../../kit/index.js';
import { LoadingEmblem } from '../room/MatchLoading.js';
import screen from '../Screen.module.css';
import styles from './EmblemSheet.module.css';

const emblemFiles = import.meta.glob<string>('../../../../../games/*/hub/emblem.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const manifestFiles = import.meta.glob<AnyManifest>('../../../../../games/*/manifest.ts', {
  eager: true,
  import: 'default',
});

/** The Emblem of every Game with a manifest, soon ones too, grouped by Island in the Hub's order. */
const GAME_SHEET = ISLANDS.flatMap((island) =>
  Object.values(manifestFiles)
    .filter((manifest) => manifest.island === island.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .flatMap((manifest) => {
      const emblem = Object.entries(emblemFiles).find(([path]) =>
        path.includes(`/games/${manifest.id}/`),
      )?.[1];
      return emblem
        ? [{ id: manifest.id, name: `${manifest.name} · Đảo ${island.name}`, emblem }]
        : [];
    }),
);

const SHEET = [
  { id: 'hub', name: 'Hub · Bến', emblem: HUB_EMBLEM },
  ...ISLANDS.map((island) => ({
    id: island.id,
    name: `Đảo ${island.name}`,
    emblem: island.emblem,
  })),
  ...GAME_SHEET,
];

const SMALL_SIZES = [64, 48, 32, 24];

/**
 * `/dev/kit#emblems`, dev only: the Hub's, the Islands' (#302) and every Game's (#303) Emblems, on the
 * 64-unit grid, at small sizes, in the loading screen's plate and on a lit card.
 */
export function EmblemSheet() {
  return (
    <main className={screen.screen}>
      <h1 className={screen.brand}>Emblem</h1>
      <dl className={styles.spec}>
        <dt>Lưới</dt>
        <dd>viewBox 64 × 64, ô 8</dd>
        <dt>Khung</dt>
        <dd>
          Hub: vòng tròn r27 + hai cung r30.5 + 4 mũi la bàn · Đảo và Game: lục giác r29 · nét 2 ·
          hình đè khung thì cắt khung theo mép hình, khe 2
        </dd>
        <dt>Hình</dt>
        <dd>khối đặc, khoét lỗ bằng evenodd, khe 2–2.5 · nét mảnh 2, nét đậm 3–3.5</dd>
        <dt>Màu</dt>
        <dd>chỉ currentColor</dd>
      </dl>
      <ul className={styles.sheet}>
        {SHEET.map(({ id, name, emblem }) => (
          <li key={id} className={styles.row}>
            <h2 className={styles.name}>{name}</h2>
            <span className={styles.grid}>
              <Emblem markup={emblem} size={256} />
            </span>
            <span className={styles.sizes}>
              {SMALL_SIZES.map((size) => (
                <Emblem key={size} markup={emblem} size={size} />
              ))}
            </span>
            <span className={styles.plate}>
              <LoadingEmblem>
                <Emblem markup={emblem} />
              </LoadingEmblem>
            </span>
            <span className={styles.card}>
              <Emblem markup={emblem} size={96} />
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
