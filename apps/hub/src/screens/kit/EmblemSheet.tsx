import { HUB_EMBLEM, ISLANDS } from '../../islands.js';
import { LoadingEmblem } from '../room/MatchLoading.js';
import screen from '../Screen.module.css';
import styles from './EmblemSheet.module.css';

const SHEET = [
  { id: 'hub', name: 'Hub · Bến', emblem: HUB_EMBLEM },
  ...ISLANDS.map((island) => ({
    id: island.id,
    name: `Đảo ${island.name}`,
    emblem: island.emblem,
  })),
];

const SMALL_SIZES = [64, 48, 32, 24];

function Svg({ markup, size }: { markup: string; size?: number }) {
  return (
    <span
      className={styles.svg}
      style={size ? { width: size, height: size } : undefined}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the Hub's own SVG files, inlined so currentColor tints them
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/**
 * `/dev/kit#emblems`, dev only: the Hub's and the Islands' Emblems for review (#302), on the 64-unit
 * grid, at small sizes, in the loading screen's plate and on a lit card.
 */
export function EmblemSheet() {
  return (
    <main className={screen.screen}>
      <h1 className={screen.brand}>Emblem</h1>
      <dl className={styles.spec}>
        <dt>Lưới</dt>
        <dd>viewBox 64 × 64, ô 8</dd>
        <dt>Khung</dt>
        <dd>Hub: vòng tròn r27 + hai cung r30.5 + 4 mũi la bàn · Đảo: lục giác r29 · nét 2</dd>
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
              <Svg markup={emblem} size={256} />
            </span>
            <span className={styles.sizes}>
              {SMALL_SIZES.map((size) => (
                <Svg key={size} markup={emblem} size={size} />
              ))}
            </span>
            <span className={styles.plate}>
              <LoadingEmblem>
                <Svg markup={emblem} />
              </LoadingEmblem>
            </span>
            <span className={styles.card}>
              <Svg markup={emblem} size={96} />
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
