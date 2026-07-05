import { buildUtf16ToCodePointMap } from "../position.js";
import type { IgnoredRange } from "../types.js";

type Utf16Range = { start: number; end: number; reason: IgnoredRange["reason"] };
type Zone = { start: number; end: number };

interface IndicesMatch extends RegExpMatchArray {
  indices: Array<[number, number]>;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWithin(offset: number, ranges: Utf16Range[]): boolean {
  return ranges.some((r) => offset >= r.start && offset < r.end);
}

function isWithinZones(offset: number, zones: Zone[]): boolean {
  return zones.some((z) => offset >= z.start && offset < z.end);
}

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/;

function findFrontmatter(text: string): Utf16Range[] {
  const m = FRONTMATTER_RE.exec(text);
  if (!m || m.index !== 0) return [];
  return [{ start: 0, end: m[0].length, reason: "frontmatter" }];
}

type LineSpan = { text: string; startUtf16: number; endUtf16: number };

function getLines(text: string): LineSpan[] {
  const lines: LineSpan[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lines.push({ text: text.slice(start, i), startUtf16: start, endUtf16: i + 1 });
      start = i + 1;
    }
  }
  lines.push({ text: text.slice(start), startUtf16: start, endUtf16: text.length });
  return lines;
}

const FENCE_OPEN_RE = /^(\s*(?:>\s*)*)(`{3,}|~{3,})/;

/**
 * Line-based (not single-regex) scan so that fences prefixed by blockquote
 * markers (`> `) are recognized. The closing fence must repeat the exact
 * same leading prefix + marker character as the opener (a v0.1 simplification
 * vs. full CommonMark, which is slightly more lenient here).
 */
function findFencedCodeBlocks(text: string): Utf16Range[] {
  const lines = getLines(text);
  const ranges: Utf16Range[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i].text.replace(/\r$/, "");
    const m = FENCE_OPEN_RE.exec(lineText);
    if (!m) continue;
    const prefix = m[1];
    const markerChar = m[2][0];
    const markerLen = m[2].length;
    const closeRe = new RegExp(`^${escapeRegExp(prefix)}${escapeRegExp(markerChar)}{${markerLen},}\\s*$`);
    let j = i + 1;
    while (j < lines.length && !closeRe.test(lines[j].text.replace(/\r$/, ""))) j++;
    const endIdx = Math.min(j, lines.length - 1);
    ranges.push({ start: lines[i].startUtf16, end: lines[endIdx].endUtf16, reason: "code_block" });
    i = endIdx;
  }
  return ranges;
}

const INLINE_CODE_RE = /(`+)([^\n]*?)\1/g;

function findInlineCode(text: string, exclude: Utf16Range[]): Utf16Range[] {
  const ranges: Utf16Range[] = [];
  for (const m of text.matchAll(INLINE_CODE_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (isWithin(start, exclude)) continue;
    ranges.push({ start, end, reason: "inline_code" });
  }
  return ranges;
}

const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/gd;

/** Markdown link `[text](url)`: URL span is ignored, link text span is returned as a zone. */
function findMarkdownLinks(text: string): { urlRanges: Utf16Range[]; linkTextZones: Zone[] } {
  const urlRanges: Utf16Range[] = [];
  const linkTextZones: Zone[] = [];
  for (const m of text.matchAll(MD_LINK_RE)) {
    const indices = (m as IndicesMatch).indices;
    const [textStart, textEnd] = indices[1];
    const [urlStart, urlEnd] = indices[2];
    linkTextZones.push({ start: textStart, end: textEnd });
    urlRanges.push({ start: urlStart, end: urlEnd, reason: "url" });
  }
  return { urlRanges, linkTextZones };
}

const BARE_URL_RE = /\bhttps?:\/\/[^\s)\]"'<>]+/g;

/**
 * Bare URL scan. Skips matches inside already-ignored ranges (first-claim-wins,
 * e.g. a URL inside a fenced code block stays tagged "code_block") and skips
 * matches fully inside a markdown-link *text* zone, so link text that itself
 * looks like a URL (e.g. `[https://fake/齟齬](https://real)`) is still checked.
 */
function findBareUrls(text: string, exclude: Utf16Range[], linkTextZones: Zone[]): Utf16Range[] {
  const ranges: Utf16Range[] = [];
  for (const m of text.matchAll(BARE_URL_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (isWithin(start, exclude)) continue;
    if (isWithinZones(start, linkTextZones) && isWithinZones(end - 1, linkTextZones)) continue;
    ranges.push({ start, end, reason: "url" });
  }
  return ranges;
}

export type IgnoreFlags = {
  codeBlock?: boolean;
  inlineCode?: boolean;
  url?: boolean;
  frontmatter?: boolean;
};

export function computeIgnoredRanges(
  text: string,
  format: "text" | "markdown",
  ignore: IgnoreFlags = {}
): IgnoredRange[] {
  const { codeBlock = true, inlineCode = true, url = true, frontmatter = true } = ignore;

  const utf16Ranges: Utf16Range[] = [];

  if (format === "markdown" && frontmatter) {
    utf16Ranges.push(...findFrontmatter(text));
  }

  if (format === "markdown" && codeBlock) {
    utf16Ranges.push(...findFencedCodeBlocks(text));
  }

  if (format === "markdown" && inlineCode) {
    utf16Ranges.push(...findInlineCode(text, utf16Ranges));
  }

  let linkTextZones: Zone[] = [];
  if (format === "markdown" && url) {
    const found = findMarkdownLinks(text);
    linkTextZones = found.linkTextZones;
    for (const r of found.urlRanges) {
      if (isWithin(r.start, utf16Ranges)) continue;
      utf16Ranges.push(r);
    }
  }

  if (url) {
    utf16Ranges.push(...findBareUrls(text, utf16Ranges, linkTextZones));
  }

  const map = buildUtf16ToCodePointMap(text);
  return utf16Ranges.map((r) => ({ start: map[r.start], end: map[r.end], reason: r.reason }));
}

export function isIgnored(index: number, ranges: IgnoredRange[]): boolean {
  return ranges.some((r) => index >= r.start && index < r.end);
}
