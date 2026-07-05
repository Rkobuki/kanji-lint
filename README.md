# kanji-lint

Detects kanji outside the 常用漢字 (jōyō kanji) list in plain text and Markdown manuscripts, reporting each hit with code-point-accurate line/column position.

## Install / build

```bash
npm install
npm run build
```

## CLI usage

```bash
kanji-lint manuscript.md
kanji-lint "docs/**/*.md"
kanji-lint manuscript.md --allow-words allow-words.txt
kanji-lint manuscript.md --allow-kanji allow-kanji.txt
kanji-lint manuscript.md --format json
```

Allow-list files: one entry per line; blank lines and lines starting with `#` are skipped. `--allow-kanji` entries must each be exactly one character.

Exit codes: `0` no issues, `1` issues found, `2` execution error (missing file, empty glob match, malformed allow-list file).

## Library usage

```ts
import { check } from "kanji-lint";

const result = check("齟齬がないか確認してください。", { format: "text" });
```

## Data provenance

`src/data/jouyou-kanji.ts` contains the 2010-revision 常用漢字表 (2,136 characters). The list was cross-verified against two independently maintained sources (`joyo-kanji` and `joyo-kanji-counts` on npm) — identical character set, identical order, no duplicates — and is guarded by integrity tests in `test/data.test.ts`.

## v0.1 scope

See the project spec for full scope. Notably out of scope for v0.1: 表外音訓 checks, ひらく/閉じる judgments, context-based replacement suggestions, proper-noun/jinmeiyō-kanji classification, variation selectors, Unicode normalization diffs, auto-fix.
