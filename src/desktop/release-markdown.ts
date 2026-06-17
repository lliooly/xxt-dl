export type ReleaseMarkdownBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export type ReleaseInlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

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

    if (isHtmlComment(line)) {
      flushList();
      continue;
    }

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

export function parseReleaseInline(text: string): ReleaseInlineNode[] {
  const nodes: ReleaseInlineNode[] = [];
  const inlinePattern = /(\*\*[^*]+\*\*)|(`[^`]+`)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text))) {
    pushText(nodes, text.slice(lastIndex, match.index));

    if (match[1]) {
      nodes.push({ type: "strong", text: match[1].slice(2, -2) });
    } else if (match[2]) {
      nodes.push({ type: "code", text: match[2].slice(1, -1) });
    } else if (match[3] && match[4]) {
      nodes.push({ type: "link", text: match[3], href: match[4] });
    } else if (match[5]) {
      nodes.push({ type: "link", text: match[5], href: match[5] });
    }

    lastIndex = match.index + match[0].length;
  }

  pushText(nodes, text.slice(lastIndex));
  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}

function pushText(nodes: ReleaseInlineNode[], text: string): void {
  if (text) {
    nodes.push({ type: "text", text });
  }
}

function isHtmlComment(line: string): boolean {
  return /^<!--.*-->$/.test(line);
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
