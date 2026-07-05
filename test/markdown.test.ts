import { describe, it, expect } from "vitest";
import { check } from "../src/check.js";
import { computeIgnoredRanges, isIgnored } from "../src/markdown/ignored-ranges.js";

describe("Markdown ignored-range exclusion", () => {
  it("excludes fenced code block content", () => {
    const text = "```js\nconst 齟 = 1;\n```\n";
    const result = check(text, { format: "markdown" });
    expect(result.issues).toHaveLength(0);

    const ranges = computeIgnoredRanges(text, "markdown", {});
    expect(ranges.some((r) => r.reason === "code_block")).toBe(true);
  });

  it("excludes inline code", () => {
    const text = "before `齟齬` after";
    const result = check(text, { format: "markdown" });
    expect(result.issues).toHaveLength(0);

    const ranges = computeIgnoredRanges(text, "markdown", {});
    expect(ranges.some((r) => r.reason === "inline_code")).toBe(true);
  });

  it("excludes bare URLs without shifting positions of surrounding text", () => {
    const text = "https://example.com/齟齬 の後に齟";
    const result = check(text, { format: "markdown" });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].text).toBe("齟");
  });

  it("checks markdown link text but excludes the URL portion", () => {
    const text = "[齟齬について](https://example.com/齟齬)";
    const result = check(text, { format: "markdown" });
    expect(result.issues.map((i) => i.text)).toEqual(["齟", "齬"]);
  });

  it("still checks link text that itself looks like a URL", () => {
    const text = "[https://fake.example/齟齬](https://example.com)";
    const result = check(text, { format: "markdown" });
    expect(result.issues.map((i) => i.text)).toEqual(["齟", "齬"]);
  });

  it("tags a URL inside a fenced code block as code_block, not url", () => {
    const text = "```\nhttps://example.com/齟齬\n```\n";
    const ranges = computeIgnoredRanges(text, "markdown", {});
    expect(ranges.every((r) => r.reason === "code_block")).toBe(true);
    expect(ranges.some((r) => r.reason === "url")).toBe(false);
  });

  it("excludes a fenced code block nested inside a blockquote", () => {
    const text = "> ```\n> const 齟 = 1;\n> ```\n";
    const result = check(text, { format: "markdown" });
    expect(result.issues).toHaveLength(0);
  });

  it("ignores frontmatter at position 0 but still checks the body", () => {
    const text = "---\n齟: 1\n---\n本文齬\n";
    const result = check(text, { format: "markdown" });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].text).toBe("齬");
  });

  it("does not treat a mid-document --- as frontmatter", () => {
    const text = "本文\n\n---\n\n齟\n";
    const result = check(text, { format: "markdown" });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].text).toBe("齟");
  });

  it("format: text skips markdown-only detectors but still strips bare URLs", () => {
    const text = "```js\n齟\n```\nhttps://example.com/齬";
    const result = check(text, { format: "text" });
    expect(result.issues.map((i) => i.text)).toEqual(["齟"]);
  });

  it("range end is exclusive, range start is inclusive", () => {
    const text = "`齟`齬";
    const ranges = computeIgnoredRanges(text, "markdown", {});
    const inlineCodeRange = ranges.find((r) => r.reason === "inline_code")!;
    expect(isIgnored(inlineCodeRange.start, ranges)).toBe(true);
    expect(isIgnored(inlineCodeRange.end, ranges)).toBe(false);

    const result = check(text, { format: "markdown" });
    expect(result.issues.map((i) => i.text)).toEqual(["齬"]);
  });
});
