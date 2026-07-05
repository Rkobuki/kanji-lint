# test-02-markdown-ignore.md

# Markdown除外の確認

本文中に齟齬がある場合は、常用漢字外として検出される。

ただし、コードブロック内の文字は検出しない。

```ts
const message = "齟齬が発生しました";
const value = "乖離";
console.log(message, value);
```

インラインコード内の `齟齬` も検出しない。

URL中の漢字も検出しない。

https://example.com/articles/齟齬と乖離について

Markdownリンクの場合、リンクテキストはチェック対象にする。
[齟齬についての記事](https://example.com/articles/齟齬)

そのため、このリンクテキスト中の齟と齬は検出される想定である。
一方、URL部分の齟と齬は検出されない想定である。

## 期待される検出

* 本文中の 齟
* 本文中の 齬
* Markdownリンクテキスト中の 齟
* Markdownリンクテキスト中の 齬

## 検出しない想定

* コードブロック内の 齟
* コードブロック内の 齬
* コードブロック内の 乖
* インラインコード内の 齟
* インラインコード内の 齬
* URL内の 齟
* URL内の 齬
