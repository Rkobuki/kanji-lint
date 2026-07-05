/**
 * Builds a map from UTF-16 code unit offset to Unicode code point index.
 * Needed because native regex match indices are UTF-16 offsets, while every
 * public position (index/line/column, IgnoredRange, allow-word span) in this
 * tool is defined in code point terms.
 */
export function buildUtf16ToCodePointMap(text: string): number[] {
  const map = new Array<number>(text.length + 1);
  let cp = 0;
  let i = 0;
  while (i < text.length) {
    map[i] = cp;
    const code = text.codePointAt(i)!;
    if (code > 0xffff) {
      map[i + 1] = cp;
      i += 2;
    } else {
      i += 1;
    }
    cp += 1;
  }
  map[text.length] = cp;
  return map;
}

export type PositionIndex = {
  codePoints: string[];
  lineOf: Uint32Array;
  columnOf: Uint32Array;
  lineStart: number[];
  lineEnd: number[];
};

/**
 * Precomputes per-code-point line/column numbers plus per-line start/end
 * code point offsets (for context slicing), all in one O(n) pass.
 */
export function buildPositionIndex(text: string): PositionIndex {
  const codePoints = Array.from(text);
  const lineOf = new Uint32Array(codePoints.length);
  const columnOf = new Uint32Array(codePoints.length);
  const lineStart: number[] = [0];
  const lineEnd: number[] = [];
  let line = 1;
  let column = 1;
  for (let i = 0; i < codePoints.length; i++) {
    lineOf[i] = line;
    columnOf[i] = column;
    if (codePoints[i] === "\n") {
      lineEnd.push(i);
      line += 1;
      column = 1;
      lineStart.push(i + 1);
    } else {
      column += 1;
    }
  }
  lineEnd.push(codePoints.length);
  return { codePoints, lineOf, columnOf, lineStart, lineEnd };
}

/** Full source line containing code point index `codePointIndex`, `\n` excluded. */
export function extractContext(pos: PositionIndex, codePointIndex: number): string {
  const lineNumber = pos.lineOf[codePointIndex];
  const start = pos.lineStart[lineNumber - 1];
  const end = pos.lineEnd[lineNumber - 1];
  return pos.codePoints.slice(start, end).join("");
}
