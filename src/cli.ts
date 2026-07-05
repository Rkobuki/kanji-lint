#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { Command } from "commander";
import { glob, isDynamicPattern } from "tinyglobby";
import { check } from "./check.js";
import type { LintIssue, CheckResult } from "./types.js";

class CliError extends Error {}

function parseAllowListLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function loadAllowWords(path: string): string[] {
  return parseAllowListLines(readFileSync(path, "utf8"));
}

function loadAllowKanji(path: string): string[] {
  const lines = parseAllowListLines(readFileSync(path, "utf8"));
  for (const line of lines) {
    if (Array.from(line).length !== 1) {
      throw new CliError(`Invalid line in allow-kanji file (expected a single character): "${line}"`);
    }
  }
  return lines;
}

function inferFormat(filePath: string): "text" | "markdown" {
  const ext = extname(filePath).toLowerCase();
  return ext === ".md" || ext === ".markdown" ? "markdown" : "text";
}

function formatTextLine(file: string, issue: LintIssue): string {
  return `${file}:${issue.line}:${issue.column} ${issue.severity} ${issue.ruleId} ${issue.text} ${issue.message}`;
}

async function resolveFiles(patterns: string[]): Promise<string[]> {
  const matchedFiles = new Set<string>();
  for (const pattern of patterns) {
    const matches = await glob(pattern, { onlyFiles: true });
    if (matches.length === 0) {
      if (isDynamicPattern(pattern)) {
        throw new CliError(`No files matched pattern: ${pattern}`);
      }
      throw new CliError(`File not found: ${pattern}`);
    }
    for (const match of matches) matchedFiles.add(match);
  }
  return [...matchedFiles].sort();
}

async function run(argv: string[]): Promise<number> {
  const program = new Command();
  program
    .name("kanji-lint")
    .argument("<patterns...>", "file paths or glob patterns to check")
    .option("--format <format>", "output format: text or json", "text")
    .option("--allow-words <path>", "path to an allow-words file")
    .option("--allow-kanji <path>", "path to an allow-kanji file")
    .option("--no-code-block", "do not exclude fenced code blocks")
    .option("--no-inline-code", "do not exclude inline code")
    .option("--no-url", "do not exclude URLs")
    .option("--no-frontmatter", "do not exclude frontmatter")
    .exitOverride()
    .configureOutput({
      writeErr: (str) => process.stderr.write(str),
    });

  program.parse(argv);
  const patterns = program.processedArgs[0] as string[];
  const opts = program.opts();

  const outputFormat = opts.format === "json" ? "json" : "text";
  const allowWords = opts.allowWords ? loadAllowWords(opts.allowWords) : [];
  const allowKanji = opts.allowKanji ? loadAllowKanji(opts.allowKanji) : [];
  const ignore = {
    codeBlock: opts.codeBlock,
    inlineCode: opts.inlineCode,
    url: opts.url,
    frontmatter: opts.frontmatter,
  };

  const files = await resolveFiles(patterns);

  const results: Array<{ file: string } & CheckResult> = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const format = inferFormat(file);
    const result = check(text, { format, allowKanji, allowWords, ignore });
    results.push({ file, ...result });
  }

  if (outputFormat === "json") {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      for (const issue of result.issues) {
        console.log(formatTextLine(result.file, issue));
      }
    }
  }

  return results.some((r) => !r.ok) ? 1 : 0;
}

run(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    if (err && err.code === "commander.helpDisplayed") {
      process.exitCode = 0;
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  });
