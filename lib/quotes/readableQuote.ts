export type QuoteContentBlock =
  | { kind: "heading"; text: string; numbered?: boolean }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[]; ordered: boolean };

const BULLET_PATTERN = /^[-*•–—] ?\s*(.+)$/;
const NUMBERED_PATTERN = /^(\d+)[.)]\s+(.+)$/;
const NUMBERED_HEADING_PATTERN = /^\d+\s+(?:[-–—]\s*)?(.+)$/;
const MARKDOWN_HEADING_PATTERN = /^#{1,4}\s+(.+)$/;
const LABEL_HEADING_PATTERN = /^(?:section\s+)?(?:roof report|scope of works|findings?|observations?|recommendations?|proposed works?|preparation|strip out|roof covering|insulation|leadwork|rainwater goods|scaffold(?:ing)?|access|waste|completion|guarantee|exclusions?|terms|notes?|option\s+[a-z0-9]+)\s*:?[\s]*$/i;

export function toQuoteContentBlocks(value?: string | null): QuoteContentBlock[] {
  const text = value?.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  const blocks: QuoteContentBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  function flushParagraph() {
    if (!paragraphLines.length) return;
    splitLongParagraph(paragraphLines.join(" ")).forEach((paragraph) => {
      blocks.push({ kind: "paragraph", text: paragraph });
    });
    paragraphLines = [];
  }

  function flushList() {
    if (!listItems.length) return;
    blocks.push({ kind: "list", items: listItems, ordered: listOrdered });
    listItems = [];
    listOrdered = false;
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const markdownHeading = line.match(MARKDOWN_HEADING_PATTERN);
    const numberedHeading = line.match(NUMBERED_HEADING_PATTERN);
    if (numberedHeading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", numbered: true, text: cleanHeading(numberedHeading[1]) });
      continue;
    }

    if (markdownHeading || isHeading(line)) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: cleanHeading(markdownHeading?.[1] ?? line) });
      continue;
    }

    const numbered = line.match(NUMBERED_PATTERN);
    const bullet = line.match(BULLET_PATTERN);
    if (numbered || bullet) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (listItems.length && listOrdered !== ordered) flushList();
      listOrdered = ordered;
      listItems.push(cleanInlineText(numbered?.[2] ?? bullet?.[1] ?? ""));
      continue;
    }

    flushList();
    paragraphLines.push(cleanInlineText(line));
  }

  flushParagraph();
  flushList();
  return blocks;
}

function isHeading(line: string) {
  const cleaned = cleanHeading(line);
  if (!cleaned || cleaned.length > 90) return false;
  if (LABEL_HEADING_PATTERN.test(cleaned)) return true;
  if (line.endsWith(":")) return !/[.!?]\s/.test(line.slice(0, -1));

  const letters = cleaned.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && cleaned === cleaned.toUpperCase() && !/[.!?]$/.test(cleaned);
}

function cleanHeading(value: string) {
  return cleanInlineText(value)
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/:$/, "")
    .trim();
}

function cleanInlineText(value: string) {
  return value.replace(/^\*\*(.+)\*\*$/, "$1").replace(/\s+/g, " ").trim();
}

function splitLongParagraph(text: string) {
  if (text.length < 360) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  const paragraphs: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 300 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs;
}
