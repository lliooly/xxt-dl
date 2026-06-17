export type ReleaseMarkdownBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export function parseReleaseMarkdown(markdown: string): ReleaseMarkdownBlock[] {
  const blocks: ReleaseMarkdownBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let pendingList: string[] = [];

  function flushList() {
    if (pendingList.length > 0) {
      blocks.push({ type: "list", items: pendingList });
      pendingList = [];
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      flushList();
      continue;
    }

    if (isTableHeader(line, lines[index + 1])) {
      flushList();
      const tableLines = [line];
      index += 2;

      while (index < lines.length && isTableRow(lines[index])) {
        tableLines.push(lines[index].trim());
        index += 1;
      }

      index -= 1;
      blocks.push(parseTable(tableLines));
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length <= 2 ? 2 : 3,
        text: headingMatch[2],
      });
      continue;
    }

    const listMatch = /^[-*]\s+(.+)$/.exec(line);
    if (listMatch) {
      pendingList.push(listMatch[1]);
      continue;
    }

    flushList();
    blocks.push({ type: "paragraph", text: line });
  }

  flushList();
  return blocks;
}

function isTableHeader(line: string, separator: string | undefined): boolean {
  return isTableRow(line) && Boolean(separator && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separator));
}

function isTableRow(line: string | undefined): boolean {
  return Boolean(line && line.trim().startsWith("|") && line.trim().endsWith("|"));
}

function parseTable(lines: string[]): Extract<ReleaseMarkdownBlock, { type: "table" }> {
  const [headerLine, ...rowLines] = lines;

  return {
    type: "table",
    headers: splitTableRow(headerLine),
    rows: rowLines.map(splitTableRow),
  };
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}
