import test from "node:test";
import assert from "node:assert/strict";

import { parseReleaseInline, parseReleaseMarkdown } from "../src/desktop/release-markdown.js";

test("parseReleaseMarkdown converts GitHub release tables into table blocks", () => {
  const blocks = parseReleaseMarkdown(`## 下载

请按你的系统选择安装包：

| 系统 | 推荐文件 | 说明 |
| --- | --- | --- |
| macOS Apple Silicon | \`.dmg\` | 打开后拖到 Applications；也可以使用 \`.pkg\` 安装 |
| Windows x64 | \`win-x64.exe\` | 标准安装器 |
`);

  assert.deepEqual(blocks, [
    { type: "heading", level: 2, text: "下载" },
    { type: "paragraph", text: "请按你的系统选择安装包：" },
    {
      type: "table",
      headers: ["系统", "推荐文件", "说明"],
      rows: [
        ["macOS Apple Silicon", "`.dmg`", "打开后拖到 Applications；也可以使用 `.pkg` 安装"],
        ["Windows x64", "`win-x64.exe`", "标准安装器"],
      ],
    },
  ]);
});

test("parseReleaseMarkdown keeps lists and paragraphs readable", () => {
  const blocks = parseReleaseMarkdown(`### 新功能

- 支持 [下载](https://example.com)
- 支持 \`latest.yml\`

普通说明`);

  assert.deepEqual(blocks, [
    { type: "heading", level: 3, text: "新功能" },
    {
      type: "list",
      items: ["支持 [下载](https://example.com)", "支持 `latest.yml`"],
    },
    { type: "paragraph", text: "普通说明" },
  ]);
});

test("parseReleaseMarkdown ignores GitHub generated HTML comments", () => {
  const blocks = parseReleaseMarkdown(`<!-- Release notes generated using configuration in .github/release.yml at v0.1.1 -->

**Full Changelog**: https://github.com/lliooly/xxt-dl/compare/v0.1.0...v0.1.1`);

  assert.deepEqual(blocks, [
    {
      type: "paragraph",
      text: "**Full Changelog**: https://github.com/lliooly/xxt-dl/compare/v0.1.0...v0.1.1",
    },
  ]);
});

test("parseReleaseInline renders bold text, inline code, markdown links, and bare urls", () => {
  assert.deepEqual(parseReleaseInline("**Full Changelog**: https://github.com/lliooly/xxt-dl/compare/v0.1.0...v0.1.1"), [
    { type: "strong", text: "Full Changelog" },
    { type: "text", text: ": " },
    {
      type: "link",
      text: "https://github.com/lliooly/xxt-dl/compare/v0.1.0...v0.1.1",
      href: "https://github.com/lliooly/xxt-dl/compare/v0.1.0...v0.1.1",
    },
  ]);

  assert.deepEqual(parseReleaseInline("下载 `.dmg` 或 [Release](https://example.com)"), [
    { type: "text", text: "下载 " },
    { type: "code", text: ".dmg" },
    { type: "text", text: " 或 " },
    { type: "link", text: "Release", href: "https://example.com" },
  ]);
});
