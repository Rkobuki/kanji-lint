import { describe, it, expect } from "vitest";
import { check } from "../src/check.js";

describe("check() core rule behavior", () => {
  it("detects non-jouyou kanji with correct index/line/column", () => {
    const result = check("齟齬", { format: "text" });
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatchObject({ text: "齟", index: 0, line: 1, column: 1 });
    expect(result.issues[1]).toMatchObject({ text: "齬", index: 1, line: 1, column: 2 });
  });

  it("does not flag ideographic iteration marks or the ideographic zero as kanji", () => {
    // 々 (U+3005) and 〻 (U+303B) are General_Category=Lm, 〇 (U+3007) is Nl —
    // all Script=Han but not actual kanji, unlike real jouyou/non-jouyou kanji (Lo).
    const result = check("人々、年々、〇〻。", { format: "text" });
    expect(result.issues).toHaveLength(0);
  });

  it("still flags a genuine non-jouyou kanji adjacent to an iteration mark", () => {
    const result = check("齟々", { format: "text" });
    expect(result.issues.map((i) => i.text)).toEqual(["齟"]);
  });

  it("reports zero issues for jouyou-only text", () => {
    const result = check("日本語のテスト", { format: "text" });
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("allowKanji suppresses a character at every occurrence", () => {
    const result = check("齟が二回、齟出てくる。", { format: "text", allowKanji: ["齟"] });
    expect(result.issues).toHaveLength(0);
  });

  it("allowWords suppresses only the occurrence inside the matched word, not elsewhere", () => {
    const result = check("齟齬について、他の場所にも齟がある。", {
      format: "text",
      allowWords: ["齟齬"],
    });
    // The 齟 and 齬 inside "齟齬" are suppressed; the standalone 齟 later is not.
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].text).toBe("齟");
    expect(result.issues[0].index).toBeGreaterThan(1);
  });

  it("treats an empty allowWords array as a no-op", () => {
    const withEmpty = check("齟齬", { format: "text", allowWords: [] });
    const withoutOption = check("齟齬", { format: "text" });
    expect(withEmpty.issues).toEqual(withoutOption.issues);
  });

  it("does not double-report when allowKanji and allowWords both cover the same character", () => {
    const result = check("齟齬", {
      format: "text",
      allowKanji: ["齟"],
      allowWords: ["齟齬"],
    });
    expect(result.issues).toHaveLength(0);
  });

  it("resets column to 1 after each newline", () => {
    const result = check("abc\n齟", { format: "text" });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ line: 2, column: 1 });
  });

  it("uses code point indexing, not UTF-16 code unit indexing, across a surrogate pair", () => {
    const astral = "\u{20000}"; // CJK Ext-B Han character, 2 UTF-16 units / 1 code point
    const result = check(`${astral}齟`, { format: "text" });
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatchObject({ index: 0, line: 1, column: 1 });
    // If indexing were UTF-16-based this would incorrectly be index 2 / column 3.
    expect(result.issues[1]).toMatchObject({ text: "齟", index: 1, line: 1, column: 2 });
  });

  it("uses fixed severity/ruleId/message/suggestion for the non_jouyou_kanji rule", () => {
    const result = check("齟", { format: "text" });
    expect(result.issues[0]).toMatchObject({
      ruleId: "non_jouyou_kanji",
      severity: "warning",
      message: "常用漢字外の漢字です",
      suggestion: null,
    });
  });

  it("summary.rules tally matches issues grouped by ruleId", () => {
    const result = check("齟齬", { format: "text" });
    expect(result.summary.issueCount).toBe(2);
    expect(result.summary.rules).toEqual({ non_jouyou_kanji: 2 });
  });
});
