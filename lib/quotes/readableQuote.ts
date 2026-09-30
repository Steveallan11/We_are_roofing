export type QuoteContentBlock =
  | { kind: "heading"; text: string; numbered?: boolean; emphasis?: boolean }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[]; ordered: boolean };

const BULLET_PATTERN = /^[-*•–—]\s*(.+)$/u;
const NUMBERED_PATTERN = /^(\d+)[.)]\s+(.+)$/;
const DASH_NUMBERED_HEADING_PATTERN = /^\d{1,3}\s*[-–—]\s*(.+)$/;
const SPACE_NUMBERED_HEADING_PATTERN = /^\d{1,3}\s+(.+)$/;
const MARKDOWN_HEADING_PATTERN = /^#{1,4}\s+(.+)$/;
const LABEL_HEADING_PATTERN = /^(?:section\s+)?(?:roof report|scope of works|findings?|observations?|recommendations?|proposed works?|preparation|strip out|roof covering|insulation|leadwork|rainwater goods|scaffold(?:ing)?|access|waste|completion|guarantee|exclusions?|terms|notes?|option\s+[a-z0-9]+)\s*:?[\s]*$/i;
const EMPHASIS_HEADING_PATTERN = /\b(?:warning|important|attention|caution|assumption|please note)\b/i;
const LEGACY_JOINED_SCOPE_PATTERN = /^(?<title>(?:new\s+)?(?:roof cleaning(?:\s*&\s*moss treatment)?|moss scrape|valley repairs?|hips?\s*(?:&|and)\s*ridges?|box gutter(?: works)?|tile replacements?|fascia,?\s*soffit\s*(?:&|and)\s*guttering|access))\s+(?<body>(?:carefully|manually|following|works\s+are|clear|remove|renew|repair|replace|prepare|prime|supply|install|apply|allow|provide)\b.+)$/i;

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

    const joinedScope = splitLegacyJoinedScopeLine(line);
    if (joinedScope) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: cleanHeading(joinedScope.title) });
      blocks.push({ kind: "paragraph", text: cleanInlineText(joinedScope.body) });
      continue;
    }

    const explicitlyBold = isOuterEmphasis(line);
    const structuralLine = unwrapOuterEmphasis(line);
    const markdownHeading = structuralLine.match(MARKDOWN_HEADING_PATTERN);
    const headingCandidate = markdownHeading?.[1] ?? structuralLine;
    const numberedHeading = headingCandidate.match(DASH_NUMBERED_HEADING_PATTERN) ?? headingCandidate.match(SPACE_NUMBERED_HEADING_PATTERN);
    if (numberedHeading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", numbered: true, text: cleanHeading(numberedHeading[1]) });
      continue;
    }

    if (markdownHeading || explicitlyBold || isHeading(structuralLine)) {
      flushParagraph();
      flushList();
      const headingText = cleanHeading(headingCandidate);
      const emphasis = explicitlyBold || isEmphasisHeading(headingText);
      blocks.push(emphasis ? { kind: "heading", emphasis: true, text: headingText } : { kind: "heading", text: headingText });
      continue;
    }

    const numbered = structuralLine.match(NUMBERED_PATTERN);
    const bullet = structuralLine.match(BULLET_PATTERN);
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

  return isUppercaseHeading(cleaned);
}

export function isUppercaseHeading(value: string) {
  const cleaned = cleanHeading(value);
  if (!cleaned || cleaned.length > 90 || /[.!?]$/.test(cleaned) || /^[£$€]?\s*[\d,./:%-]+$/.test(cleaned)) return false;
  const letters = [...cleaned].filter((character) => /[A-Za-z]/.test(character));
  if (letters.length < 2) return false;
  const uppercaseLetters = letters.filter((character) => character === character.toUpperCase()).length;
  return uppercaseLetters / letters.length >= 0.8;
}

export function formatScopeNumber(index: number) {
  return String(Math.max(0, Math.floor(index)) + 1).padStart(2, "0");
}

function cleanHeading(value: string) {
  return cleanInlineText(value).replace(/:$/, "").trim();
}

function cleanInlineText(value: string) {
  return unwrapOuterEmphasis(value).replace(/\s+/g, " ").trim();
}

function unwrapOuterEmphasis(value: string) {
  return value.replace(/^\*\*(.+)\*\*$/, "$1").replace(/^__(.+)__$/, "$1").trim();
}

function isOuterEmphasis(value: string) {
  return /^(?:\*\*.+\*\*|__.+__)$/.test(value.trim());
}

function isEmphasisHeading(value: string) {
  return EMPHASIS_HEADING_PATTERN.test(value);
}

function splitLegacyJoinedScopeLine(value: string) {
  const match = unwrapOuterEmphasis(value).match(LEGACY_JOINED_SCOPE_PATTERN);
  return match?.groups ? { title: match.groups.title, body: match.groups.body } : null;
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
