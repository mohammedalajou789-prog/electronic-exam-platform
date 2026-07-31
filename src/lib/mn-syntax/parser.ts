// src/lib/mn-syntax/parser.ts

export type MnToken =
  | { type: 'paragraph'; children: MnInlineToken[] }
  | { type: 'list'; items: MnInlineToken[][] }
  | { type: 'callout'; children: MnInlineToken[] }
  | { type: 'image_slot'; slotNumber: 1 | 2 | 3 }
  | { type: 'table'; headers: MnInlineToken[][]; rows: MnInlineToken[][][] };

export type MnInlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'highlight'; value: string }
  | { type: 'highlight_bold'; value: string }
  | { type: 'green'; value: string }
  | { type: 'blue'; value: string }
  | { type: 'underline'; value: string };

export function parseInline(text: string): MnInlineToken[] {
  const tokens: MnInlineToken[] = [];
  const pattern =
    /==([\s\S]+?)==|(\*\*([\s\S]+?)\*\*)|(\*([\s\S]+?)\*)|(__([\s\S]+?)__)|!!([\s\S]+?)!!|~~([\s\S]+?)~~|::([\s\S]+?)::/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // ==...== — check if content is wrapped in **...**
      const inner = match[1];
      const boldInside = /^\*\*([\s\S]+)\*\*$/.exec(inner);
      if (boldInside) {
        tokens.push({ type: 'highlight_bold', value: boldInside[1] });
      } else {
        tokens.push({ type: 'highlight', value: inner });
      }
    } else if (match[2] !== undefined) {
      tokens.push({ type: 'bold', value: match[3] as string });
    } else if (match[4] !== undefined) {
      tokens.push({ type: 'italic', value: match[5] as string });
    } else if (match[6] !== undefined) {
      tokens.push({ type: 'underline', value: match[7] as string });
    } else if (match[8] !== undefined) {
      tokens.push({ type: 'green', value: match[8] });
    } else if (match[9] !== undefined) {
      tokens.push({ type: 'blue', value: match[9] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return tokens;
}
function parseTable(raw: string): { headers: MnInlineToken[][]; rows: MnInlineToken[][][] } {
  const lines = raw
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'))
    .filter((l) => !/^\|[\s|:-]+\|$/.test(l));

  const parseRow = (line: string): MnInlineToken[][] => {
    return line
      .slice(1, -1)
      .split('|')
      .map((cell) => parseInline(cell.trim()));
  };

  const headers = lines[0] ? parseRow(lines[0]) : [];
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}
function pushParagraphs(text: string, tokens: MnToken[]): void {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trim());

    // Mixed paragraph: some lines are list items, some are not
    // We process line by line
    let currentListItems: MnInlineToken[][] = [];
    let currentTextLines: string[] = [];

    function flushText() {
      if (currentTextLines.length === 0) return;
      const joined = currentTextLines.join(' ');
      const children = parseInline(joined);
      if (children.length > 0) {
        tokens.push({ type: 'paragraph', children });
      }
      currentTextLines = [];
    }

    function flushList() {
      if (currentListItems.length === 0) return;
      tokens.push({ type: 'list', items: currentListItems });
      currentListItems = [];
    }

    for (const line of lines) {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        flushText();
        currentListItems.push(parseInline(line.slice(2)));
      } else {
        flushList();
        currentTextLines.push(line);
      }
    }

    flushText();
    flushList();
  }
}

function processTextChunk(text: string, tokens: MnToken[]): void {
  const calloutRegex = /!!(.+?)!!/gs;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = calloutRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushParagraphs(text.slice(lastIndex, match.index), tokens);
    }
    tokens.push({
      type: 'callout',
      children: parseInline(match[1].trim()),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    pushParagraphs(text.slice(lastIndex), tokens);
  }
}

export function parseMnSyntax(raw: string): MnToken[] {
  const tokens: MnToken[] = [];

  type Segment =
    | { kind: 'raw'; text: string }
    | { kind: 'table'; content: string };

  const segments: Segment[] = [];
  const tableRegex = /\[TABLE\]([\s\S]*?)\[\/TABLE\]/g;
  let lastIdx = 0;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(raw)) !== null) {
    if (tableMatch.index > lastIdx) {
      segments.push({ kind: 'raw', text: raw.slice(lastIdx, tableMatch.index) });
    }
    segments.push({ kind: 'table', content: tableMatch[1] });
    lastIdx = tableMatch.index + tableMatch[0].length;
  }
  if (lastIdx < raw.length) {
    segments.push({ kind: 'raw', text: raw.slice(lastIdx) });
  }

  for (const segment of segments) {
    if (segment.kind === 'table') {
      const { headers, rows } = parseTable(segment.content);
      tokens.push({ type: 'table', headers, rows });
      continue;
    }

    const slotRegex = /\[Image Slot\s*(\d)?\]/gi;
    const text = segment.text;
    const parts = text.split(slotRegex);

    let i = 0;
    while (i < parts.length) {
      const part = parts[i];
      if (i % 2 === 0) {
        // Text chunk
        if (part && part.trim()) {
          processTextChunk(part, tokens);
        }
      } else {
        // Image slot number
        const num = parseInt(part ?? '1', 10);
        const slotNumber = (num >= 1 && num <= 3 ? num : 1) as 1 | 2 | 3;
        tokens.push({ type: 'image_slot', slotNumber });
      }
      i++;
    }
  }

  return tokens;
}