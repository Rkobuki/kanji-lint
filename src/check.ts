import { buildPositionIndex } from "./position.js";
import { computeIgnoredRanges } from "./markdown/ignored-ranges.js";
import { RULE_ID, computeAllowWordSpans, runNonJouyouKanjiRule } from "./rules/non-jouyou-kanji.js";
import type { CheckOptions, CheckResult, LintIssue } from "./types.js";

export function check(text: string, options: CheckOptions = {}): CheckResult {
  const format = options.format ?? "markdown";
  const rules = options.rules ?? [RULE_ID];
  const allowKanji = options.allowKanji ?? [];
  const allowWords = options.allowWords ?? [];
  const ignore = {
    codeBlock: options.ignore?.codeBlock ?? true,
    inlineCode: options.ignore?.inlineCode ?? true,
    url: options.ignore?.url ?? true,
    frontmatter: options.ignore?.frontmatter ?? true,
  };

  const positionIndex = buildPositionIndex(text);
  const ignoredRanges = computeIgnoredRanges(text, format, ignore);
  const allowKanjiSet = new Set(allowKanji);
  const allowWordSpans = computeAllowWordSpans(text, allowWords);

  let issues: LintIssue[] = [];
  if (rules.includes(RULE_ID)) {
    issues = runNonJouyouKanjiRule(
      positionIndex.codePoints,
      positionIndex,
      ignoredRanges,
      allowKanjiSet,
      allowWordSpans
    );
  }

  const rulesSummary: Record<string, number> = {};
  for (const issue of issues) {
    rulesSummary[issue.ruleId] = (rulesSummary[issue.ruleId] ?? 0) + 1;
  }

  return {
    ok: issues.length === 0,
    summary: {
      issueCount: issues.length,
      rules: rulesSummary,
    },
    issues,
  };
}
