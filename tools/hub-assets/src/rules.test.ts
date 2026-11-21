import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageChars, parseRules, RULES_MAX_PAGE_CHARS, RULES_MAX_PAGES } from './rules.js';

describe('parseRules', () => {
  it('makes the text under # a first page and each ## a page', () => {
    const { pages, problems } = parseRules(
      '# Luật Demo\n\nMở đầu.\n\n## Một\n\nChữ **đậm**.\n\n## Hai\n\n- a\n- b\n',
    );
    expect(problems).toEqual([]);
    expect(pages.map((p) => p.title)).toEqual(['Luật Demo', 'Một', 'Hai']);
    expect(pages[1]?.blocks).toEqual([{ kind: 'text', text: 'Chữ **đậm**.' }]);
    expect(pages[2]?.blocks).toEqual([{ kind: 'list', items: ['a', 'b'] }]);
  });

  it('has no intro page when nothing sits between # and the first ##', () => {
    const { pages } = parseRules('# Luật Demo\n\n## Một\n\nA.\n');
    expect(pages.map((p) => p.title)).toEqual(['Một']);
  });

  it('shows a file without ## as one scrolling page, however long', () => {
    const { pages, problems } = parseRules(`# Luật Demo\n\n${'chữ '.repeat(500)}\n`);
    expect(problems).toEqual([]);
    expect(pages).toHaveLength(1);
    expect(pageChars(pages[0]?.blocks ?? [])).toBeGreaterThan(RULES_MAX_PAGE_CHARS);
  });

  it('joins wrapped lines into one paragraph or list item', () => {
    const { pages } = parseRules('## Một\n\nDòng một\ndòng hai.\n\n- mục\n  tiếp\n- hai\n');
    expect(pages[0]?.blocks).toEqual([
      { kind: 'text', text: 'Dòng một dòng hai.' },
      { kind: 'list', items: ['mục tiếp', 'hai'] },
    ]);
  });

  it('reads a table and an image', () => {
    const { pages } = parseRules(
      '## Một\n\n![Bàn cờ](hub/rules/ban.webp)\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n',
    );
    expect(pages[0]?.image).toEqual({ alt: 'Bàn cờ', path: 'hub/rules/ban.webp' });
    expect(pages[0]?.blocks).toEqual([
      {
        kind: 'table',
        head: ['A', 'B'],
        rows: [
          ['1', '2'],
          ['3', '4'],
        ],
      },
    ]);
  });

  it('counts text without markdown marks', () => {
    const { pages } = parseRules('## Một\n\n**ab** `cd` *e*\n');
    expect(pageChars(pages[0]?.blocks ?? [])).toBe('ab cd e'.length);
  });

  it('refuses a page over the limit, too many pages and two images', () => {
    const long = parseRules(`## Dài\n\n${'a'.repeat(RULES_MAX_PAGE_CHARS + 1)}\n`);
    expect(long.problems).toEqual([
      `RULES.md "Dài" has ${RULES_MAX_PAGE_CHARS + 1} characters: at most ${RULES_MAX_PAGE_CHARS} per page`,
    ]);

    const many = parseRules(
      Array.from({ length: RULES_MAX_PAGES + 1 }, (_, i) => `## Trang ${i}\n\nChữ.\n`).join('\n'),
    );
    expect(many.problems).toEqual([
      `RULES.md has ${RULES_MAX_PAGES + 1} pages: at most ${RULES_MAX_PAGES}`,
    ]);

    const twice = parseRules('## Một\n\n![a](hub/rules/a.webp)\n\n![b](hub/rules/b.webp)\n');
    expect(twice.problems).toEqual(['RULES.md "Một" has more than one image']);
  });
});

describe("the Games' RULES.md", () => {
  const games = join(import.meta.dirname, '../../../games');
  const ids = readdirSync(games).filter((id) => existsSync(join(games, id, 'RULES.md')));

  it('includes Tiến Lên and Đặt Bom', () => {
    expect(ids).toEqual(expect.arrayContaining(['tien-len', 'dat-bom']));
  });

  it.each(ids)('%s fits the pager', (id) => {
    const { pages, problems } = parseRules(readFileSync(join(games, id, 'RULES.md'), 'utf8'));
    expect(problems).toEqual([]);
    expect(pages.length).toBeGreaterThan(1);
  });
});
