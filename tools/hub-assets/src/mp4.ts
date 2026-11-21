/** The length of an MP4 in seconds, from its `moov/mvhd` box; undefined when it has none. */
export function mp4Duration(bytes: Buffer): number | undefined {
  const mvhd = find(bytes, 0, bytes.length, ['moov', 'mvhd']);
  if (mvhd === undefined) return undefined;
  const long = bytes[mvhd] === 1;
  const at = mvhd + (long ? 20 : 12);
  if (at + (long ? 12 : 8) > bytes.length) return undefined;
  const scale = bytes.readUInt32BE(at);
  const length = long ? Number(bytes.readBigUInt64BE(at + 4)) : bytes.readUInt32BE(at + 4);
  return scale > 0 ? length / scale : undefined;
}

/** The offset of the body of the box at the end of `path`, looking inside each parent in turn. */
function find(bytes: Buffer, start: number, end: number, path: string[]): number | undefined {
  for (let at = start; at + 8 <= end; ) {
    const size = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    if (size < 8) return undefined;
    const next = Math.min(end, at + size);
    if (type === path[0]) {
      return path.length === 1 ? at + 8 : find(bytes, at + 8, next, path.slice(1));
    }
    at = next;
  }
  return undefined;
}
