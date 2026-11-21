/** A Game shows at most this many rules pages. */
export const RULES_MAX_PAGES = 8;
/** The most text one rules page holds, markdown marks not counted. */
export const RULES_MAX_PAGE_CHARS = 400;
/** The page illustration: 16:9, at least this big. */
export const RULES_IMAGE = { width: 1280, height: 720 } as const;

export type RulesBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

/** One page of a Game's rules, as the Hub draws it; `text` keeps `**bold**`, `*italic*` and `` `code` ``. */
export interface RulesPage {
  title: string;
  /** Written by `buildHubAssets` once the file `hub/rules/<name>.webp` is checked. */
  image?: { url: string; alt: string };
  blocks: RulesBlock[];
}

/** A page before its image file is looked at: `image` is the markdown's path. */
export interface RulesDraft {
  title: string;
  image?: { path: string; alt: string };
  blocks: RulesBlock[];
}

export interface ParsedRules {
  pages: RulesDraft[];
  problems: string[];
}

const FALLBACK_TITLE = 'Luật chơi';
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]*)\)\s*$/;
const SEPARATOR_CELL = /^:?-{3,}:?$/;

/** The characters a player reads on a page: all text, no markdown marks, no title. */
export function pageChars(blocks: RulesBlock[]): number {
  const texts = blocks.flatMap((block) => {
    if (block.kind === 'text') return [block.text];
    if (block.kind === 'list') return block.items;
    return [...block.head, ...block.rows.flat()];
  });
  return texts.reduce((sum, text) => sum + [...plain(text)].length, 0);
}

function plain(text: string) {
  return text.normalize('NFC').replace(/[*`]/g, '');
}

/**
 * Splits a Game's `RULES.md` into pages: each `##` section is one page named by its heading, and
 * the text between `#` and the first `##` is a page named by the `#` heading. A file without
 * `##` is one scrolling page. Problems are listed when a multi-page file has more than
 * `RULES_MAX_PAGES` pages or a page holds more than `RULES_MAX_PAGE_CHARS` characters, or when a
 * page has two images.
 */
export function parseRules(markdown: string): ParsedRules {
  const problems: string[] = [];
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let title = FALLBACK_TITLE;
  const sections: { title: string | null; lines: string[] }[] = [{ title: null, lines: [] }];
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    const level = heading?.[1]?.length ?? 0;
    const text = heading?.[2] ?? '';
    if (level === 1 && sections.length === 1 && sections[0]?.lines.every((l) => !l.trim())) {
      title = text || FALLBACK_TITLE;
      continue;
    }
    if (level === 2) {
      sections.push({ title: text, lines: [] });
    } else {
      if (level > 2) problems.push(`RULES.md: "${line.trim()}": only # and ## headings are used`);
      sections[sections.length - 1]?.lines.push(line);
    }
  }

  const drafts = sections.map((section) => ({
    title: section.title ?? title,
    ...readBlocks(section.lines, section.title ?? title, problems),
  }));
  const [intro, ...rest] = drafts;
  const pages =
    rest.length === 0 || !intro || intro.blocks.length > 0 || intro.image ? drafts : rest;

  if (rest.length > 0) {
    if (pages.length > RULES_MAX_PAGES) {
      problems.push(`RULES.md has ${pages.length} pages: at most ${RULES_MAX_PAGES}`);
    }
    for (const page of pages) {
      const chars = pageChars(page.blocks);
      if (chars > RULES_MAX_PAGE_CHARS) {
        problems.push(
          `RULES.md "${page.title}" has ${chars} characters: at most ${RULES_MAX_PAGE_CHARS} per page`,
        );
      }
    }
  }
  return {
    pages: pages.map(({ title: t, image, blocks }) => ({ title: t, image, blocks })),
    problems,
  };
}

function readBlocks(lines: string[], page: string, problems: string[]) {
  const blocks: RulesBlock[] = [];
  let image: RulesDraft['image'];
  let current: RulesBlock | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const picture = IMAGE_LINE.exec(line.trim());
    if (picture) {
      flush();
      if (image) problems.push(`RULES.md "${page}" has more than one image`);
      image = { alt: picture[1] ?? '', path: picture[2] ?? '' };
      continue;
    }
    if (line.trimStart().startsWith('|')) {
      const cells = splitRow(line);
      if (current?.kind !== 'table') {
        flush();
        current = { kind: 'table', head: cells, rows: [] };
      } else if (!cells.every((cell) => SEPARATOR_CELL.test(cell))) {
        current.rows.push(cells);
      }
      continue;
    }
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (current?.kind !== 'list') {
        flush();
        current = { kind: 'list', items: [] };
      }
      current.items.push(item[1] ?? '');
      continue;
    }
    const text = line.trim();
    if (current?.kind === 'list' && /^\s/.test(line)) {
      const last = current.items.length - 1;
      current.items[last] = `${current.items[last]} ${text}`;
    } else if (current?.kind === 'text') {
      current.text = `${current.text} ${text}`;
    } else {
      flush();
      current = { kind: 'text', text };
    }
  }
  flush();
  return { image, blocks };
}

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}
