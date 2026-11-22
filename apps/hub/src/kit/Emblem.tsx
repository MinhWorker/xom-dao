import styles from './Emblem.module.css';

export interface EmblemProps {
  /** One-colour SVG markup painted with `currentColor`: an Emblem file's text. */
  markup: string;
  /** Pixels; the box fills its container when left out. */
  size?: number;
}

/** An Emblem, inlined so it takes the text colour. */
export function Emblem({ markup, size }: EmblemProps) {
  return (
    <span
      className={styles.emblem}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the repo's own SVG files, checked by tools/hub-assets, inlined so currentColor tints them
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
