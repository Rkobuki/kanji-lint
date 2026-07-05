# kanji-lint

`kanji-lint` は、テキストやMarkdown原稿に含まれる **常用漢字外の漢字** を検出するためのCLI / ライブラリです。

編集・校正作業で、原稿中に混ざった常用漢字外の漢字を見つけることを目的としています。

## 特徴

* 常用漢字表に含まれない漢字を検出
* 行番号・桁番号つきで検出結果を表示
* Markdown原稿に対応
* Markdown中のコードブロック、インラインコード、URL、frontmatterを標準で除外
* 許容する語句・漢字を allow-list で指定可能
* テキスト出力とJSON出力に対応
* CLIとしてもライブラリとしても利用可能

## インストール / ビルド

```bash
npm install
npm run build
```

開発中に直接実行する場合は、次のようにします。

```bash
npm run dev -- manuscript.md
```

ビルド後、CLIとして使う場合は次のように実行します。

```bash
kanji-lint manuscript.md
```

## 使い方

### ファイルをチェックする

```bash
kanji-lint manuscript.md
```

検出結果は次の形式で表示されます。

```text
manuscript.md:2:12 warning non_jouyou_kanji 齟 常用漢字外の漢字です
```

形式は以下のとおりです。

```text
ファイル名:行番号:桁番号 severity ruleId 検出文字 メッセージ
```

### 複数ファイルをチェックする

globパターンを指定できます。

```bash
kanji-lint "docs/**/*.md"
```

### JSONで出力する

```bash
kanji-lint manuscript.md --format json
```

JSON出力では、ファイルごとの検出結果、件数、ルール別の集計を確認できます。

## allow-list

原稿の性質上、特定の語句や漢字を許容したい場合は allow-list を指定できます。

### 語句単位で許容する

```bash
kanji-lint manuscript.md --allow-words allow-words.txt
```

`allow-words.txt` の例です。

```text
# コメント行は無視されます
齟齬
樋口
```

`--allow-words` で指定した語句に含まれる漢字は、その語句として出現した場合だけ検出対象から外れます。

たとえば `齟齬` を許容した場合、`齟齬` の中の `齟` と `齬` は検出されませんが、別の場所に単独で出てくる `齟` は検出されます。

### 漢字単位で許容する

```bash
kanji-lint manuscript.md --allow-kanji allow-kanji.txt
```

`allow-kanji.txt` の例です。

```text
# 1行に1文字だけ書きます
齟
齬
```

`--allow-kanji` の各行は、ちょうど1文字である必要があります。2文字以上の行がある場合はエラーになります。

## Markdownで標準除外される範囲

Markdownファイルでは、次の範囲を標準でチェック対象から外します。

* fenced code block
* inline code
* URL
* frontmatter

たとえば次のようなURL中の漢字は検出されません。

```markdown
https://example.com/齟齬
```

一方、Markdownリンクのリンクテキストは本文として扱います。

```markdown
[齟齬について](https://example.com/齟齬)
```

この場合、リンク先URLの `齟齬` は除外されますが、リンクテキストの `齟齬` は検出対象になります。

## 除外設定を無効にする

標準ではMarkdown中の一部要素を除外しますが、オプションで無効にできます。

```bash
kanji-lint manuscript.md --no-code-block
kanji-lint manuscript.md --no-inline-code
kanji-lint manuscript.md --no-url
kanji-lint manuscript.md --no-frontmatter
```

各オプションの意味は次のとおりです。

| オプション              | 意味                |
| ------------------ | ----------------- |
| `--no-code-block`  | コードブロックを除外しない     |
| `--no-inline-code` | インラインコードを除外しない    |
| `--no-url`         | URLを除外しない         |
| `--no-frontmatter` | frontmatterを除外しない |

## 終了コード

| 終了コード | 意味          |
| ----: | ----------- |
|   `0` | 問題なし        |
|   `1` | 常用漢字外の漢字を検出 |
|   `2` | 実行エラー       |

実行エラーには、ファイルが存在しない、globに一致するファイルがない、allow-listの形式が不正、などが含まれます。

## ライブラリとして使う

```ts
import { check } from "@rkobuki/kanji-lint";

const result = check("齟齬がないか確認してください。", {
  format: "text",
});

console.log(result.ok);
console.log(result.issues);
```

`check()` は次のような結果を返します。

```ts
{
  ok: boolean;
  summary: {
    issueCount: number;
    rules: Record<string, number>;
  };
  issues: Array<{
    ruleId: string;
    severity: "info" | "warning" | "error";
    message: string;
    text: string;
    index: number;
    line: number;
    column: number;
    context?: string;
    suggestion?: string | null;
  }>;
}
```

## APIオプション

```ts
check(text, {
  format: "markdown",
  allowKanji: ["齟"],
  allowWords: ["齟齬"],
  ignore: {
    codeBlock: true,
    inlineCode: true,
    url: true,
    frontmatter: true,
  },
});
```

| オプション                | 説明                          |
| -------------------- | --------------------------- |
| `format`             | `"text"` または `"markdown"`   |
| `allowKanji`         | 許容する漢字の配列                   |
| `allowWords`         | 許容する語句の配列                   |
| `ignore.codeBlock`   | Markdownのコードブロックを除外する       |
| `ignore.inlineCode`  | Markdownのインラインコードを除外する      |
| `ignore.url`         | URLを除外する                    |
| `ignore.frontmatter` | Markdown先頭のfrontmatterを除外する |

## 判定仕様

* 常用漢字表に含まれない漢字を `non_jouyou_kanji` として検出します。
* 検出時の severity は `warning` です。
* 位置情報はUnicodeコードポイント単位で扱います。
* `々` や `〇` など、漢字に隣接して使われることがある記号は、漢字そのものとしては扱いません。

## データ

`src/data/jouyou-kanji.ts` に、2010年改定の常用漢字表に基づく2,136字のデータを収録しています。

データについては、重複がないこと、2,136字であること、代表的な常用漢字・常用漢字外の漢字の含有関係などをテストで確認しています。

## v0.1の範囲

v0.1では、常用漢字外の漢字検出に範囲を絞っています。

現時点では、次の機能は対象外です。

* 表外音訓の判定
* ひらく / 閉じるの判断
* 文脈に応じた言い換え候補の提示
* 固有名詞・人名用漢字の分類
* 異体字・variation selectorの差分検出
* Unicode正規化の差分検出
* 自動修正

## 開発

```bash
npm install
npm run typecheck
npm test
npm run build
```

テストは Vitest で実行します。

```bash
npm test
```
