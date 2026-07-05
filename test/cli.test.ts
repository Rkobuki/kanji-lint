import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectRoot = process.cwd();
const tsxBin = join(projectRoot, "node_modules", ".bin", "tsx");
const cliEntry = join(projectRoot, "src", "cli.ts");

function runCli(args: string[], cwd: string = projectRoot) {
  const result = spawnSync(tsxBin, [cliEntry, ...args], { cwd, encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "kanji-lint-test-"));
  writeFileSync(join(dir, "dirty.md"), "齟齬があります。\n");
  writeFileSync(join(dir, "clean.md"), "日本語のテストです。\n");
  writeFileSync(join(dir, "allow-words.txt"), "# comment\n\n齟齬\n");
  writeFileSync(join(dir, "allow-kanji.txt"), "# comment\n\n齟\n");
  writeFileSync(join(dir, "bad-allow-kanji.txt"), "齟齬\n");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("kanji-lint CLI", () => {
  it("exits 1 when a file has issues", () => {
    const { status, stdout } = runCli([join(dir, "dirty.md")]);
    expect(status).toBe(1);
    expect(stdout).toContain("non_jouyou_kanji");
  });

  it("exits 0 when a file is clean", () => {
    const { status, stdout } = runCli([join(dir, "clean.md")]);
    expect(status).toBe(0);
    expect(stdout).toBe("");
  });

  it("aggregates multiple glob-matched files into a JSON array", () => {
    const { status, stdout } = runCli(["*.md", "--format", "json"], dir);
    expect(status).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    const files = parsed.map((r: { file: string }) => r.file).sort();
    expect(files).toEqual(["clean.md", "dirty.md"]);
  });

  it("loads allow-words file, skipping comments and blank lines", () => {
    const { status } = runCli([
      join(dir, "dirty.md"),
      "--allow-words",
      join(dir, "allow-words.txt"),
    ]);
    expect(status).toBe(0);
  });

  it("loads allow-kanji file, skipping comments and blank lines", () => {
    const { status, stdout } = runCli([
      join(dir, "dirty.md"),
      "--allow-kanji",
      join(dir, "allow-kanji.txt"),
    ]);
    // allow-kanji.txt only allows 齟, so 齬 is still reported.
    expect(status).toBe(1);
    expect(stdout).toContain("齬");
    expect(stdout).not.toContain("齟 ");
  });

  it("exits 2 on a malformed allow-kanji file", () => {
    const { status, stderr } = runCli([
      join(dir, "dirty.md"),
      "--allow-kanji",
      join(dir, "bad-allow-kanji.txt"),
    ]);
    expect(status).toBe(2);
    expect(stderr).toContain("Invalid line in allow-kanji file");
  });

  it("exits 2 for a nonexistent file", () => {
    const { status, stderr } = runCli([join(dir, "does-not-exist.md")]);
    expect(status).toBe(2);
    expect(stderr).toContain("File not found");
  });

  it("exits 2 when a glob pattern matches zero files", () => {
    const { status, stderr } = runCli(["*.nonexistent-ext"], dir);
    expect(status).toBe(2);
    expect(stderr).toContain("No files matched pattern");
  });
});
