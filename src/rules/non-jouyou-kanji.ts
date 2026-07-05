import type { LintIssue, IgnoredRange } from "../types.js";
import type { PositionIndex } from "../position.js";
import { extractContext, buildUtf16ToCodePointMap } from "../position.js";
import { JOUYOU_KANJI_SET } from "../data/jouyou-kanji.js";
import { isIgnored } from "../markdown/ignored-ranges.js";

export const RULE_ID = "non_jouyou_kanji";

// Script=Han alone also matches non-kanji Han-block symbols such as 々 (U+3005,
// General_Category=Lm) and 〇 (U+3007, General_Category=Nl) — iteration marks and
// the ideographic zero, not kanji themselves. Real kanji are General_Category=Lo,
// so requiring both excludes these false positives without a maintained blocklist.
const KANJI_RE = /(?=\p{Script=Han})\p{General_Category=Lo}/u;

export function isKanji(char: string): boolean {
  return KANJI_RE.test(char);
}

export type Span = [start: number, end: number];

/**
 * Every (including overlapping) occurrence of each allow-word in `text`,
 * converted to code point spans. A kanji is only suppressed for the specific
 * occurrence(s) geometrically inside one of these spans — the same kanji
 * elsewhere in the text is still reported.
 */
export function computeAllowWordSpans(text: string, allowWords: string[]): Span[] {
  if (allowWords.length === 0) return [];
  const map = buildUtf16ToCodePointMap(text);
  const spans: Span[] = [];
  for (const word of allowWords) {
    if (word.length === 0) continue;
    for (let idx = text.indexOf(word); idx !== -1; idx = text.indexOf(word, idx + 1)) {
      spans.push([map[idx], map[idx + word.length]]);
    }
  }
  return spans;
}

function isWithinAnySpan(index: number, spans: Span[]): boolean {
  return spans.some(([start, end]) => index >= start && index < end);
}

export function runNonJouyouKanjiRule(
  codePoints: string[],
  positionIndex: PositionIndex,
  ignoredRanges: IgnoredRange[],
  allowKanjiSet: ReadonlySet<string>,
  allowWordSpans: Span[]
): LintIssue[] {
  const issues: LintIssue[] = [];
  for (let i = 0; i < codePoints.length; i++) {
    if (isIgnored(i, ignoredRanges)) continue;
    const ch = codePoints[i];
    if (!isKanji(ch)) continue;
    if (JOUYOU_KANJI_SET.has(ch)) continue;
    if (allowKanjiSet.has(ch)) continue;
    if (isWithinAnySpan(i, allowWordSpans)) continue;

    issues.push({
      ruleId: RULE_ID,
      severity: "warning",
      message: "常用漢字外の漢字です",
      text: ch,
      index: i,
      line: positionIndex.lineOf[i],
      column: positionIndex.columnOf[i],
      context: extractContext(positionIndex, i),
      suggestion: null,
    });
  }
  return issues;
}
