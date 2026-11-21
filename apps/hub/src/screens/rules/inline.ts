export interface InlinePart {
  kind: 'plain' | 'strong' | 'em' | 'code';
  text: string;
  /** Where the run starts in the source line: unique within it, so it serves as a key. */
  at: number;
}

const MARKS = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/;

/** Splits a rules line into plain text and its `**bold**`, `*italic*` and `` `code` `` runs. */
export function parseInline(text: string): InlinePart[] {
  let at = 0;
  return text
    .split(MARKS)
    .filter(Boolean)
    .map((part): InlinePart => {
      const start = at;
      at += part.length;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return { kind: 'strong', text: part.slice(2, -2), at: start };
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return { kind: 'code', text: part.slice(1, -1), at: start };
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return { kind: 'em', text: part.slice(1, -1), at: start };
      }
      return { kind: 'plain', text: part, at: start };
    });
}
