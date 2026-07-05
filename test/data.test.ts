import { describe, it, expect } from "vitest";
import { JOUYOU_KANJI, JOUYOU_KANJI_SET } from "../src/data/jouyou-kanji.js";

describe("JOUYOU_KANJI data integrity", () => {
  it("has exactly 2136 entries", () => {
    expect(JOUYOU_KANJI.length).toBe(2136);
  });

  it("has no duplicates", () => {
    expect(new Set(JOUYOU_KANJI).size).toBe(2136);
  });

  it("every entry is exactly one Han-script code point", () => {
    for (const entry of JOUYOU_KANJI) {
      expect(Array.from(entry).length).toBe(1);
      expect(/^\p{Script=Han}$/u.test(entry)).toBe(true);
    }
  });

  it("contains well-known jouyou kanji", () => {
    for (const ch of ["日", "本", "語", "生", "学"]) {
      expect(JOUYOU_KANJI_SET.has(ch)).toBe(true);
    }
  });

  it("does not contain well-known non-jouyou kanji", () => {
    for (const ch of ["齟", "齬"]) {
      expect(JOUYOU_KANJI_SET.has(ch)).toBe(false);
    }
  });
});
