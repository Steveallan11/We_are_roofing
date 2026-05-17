import { createHash } from "crypto";

type ParsedUploadRecord = {
  recordType: "historical_quote" | "knowledge_base";
  title: string;
  content: string;
  tags: string[];
  category: string;
  sourceReference: string;
  sourceDate: string | null;
  sourceYear: number | null;
  roofType: string | null;
  jobType: string | null;
  originalTotal: number | null;
  scopeExcerpt: string | null;
  materialsExcerpt: string | null;
};

type ParsedUpload = {
  records: ParsedUploadRecord[];
  warning?: string;
};

const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json"];

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function hashSource(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function parseMoney(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/(?:£|gbp)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function parseYear(value: unknown) {
  const text = clean(value);
  const year = Number(text.match(/\b(20[0-9]{2}|19[8-9][0-9])\b/)?.[1]);
  return Number.isFinite(year) ? year : null;
}

function parseDate(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function inferRoofType(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("flat")) return "Flat";
  if (lower.includes("slate")) return "Slate";
  if (lower.includes("tile") || lower.includes("pitched")) return "Pitched";
  if (lower.includes("fascia") || lower.includes("soffit") || lower.includes("gutter")) return "Fascia";
  if (lower.includes("chimney") || lower.includes("lead")) return "Chimney";
  return null;
}

function inferJobType(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("repair")) return "Repair";
  if (lower.includes("replacement") || lower.includes("replace")) return "Replacement";
  if (lower.includes("new roof")) return "New Roof";
  if (lower.includes("maintenance")) return "Maintenance";
  return null;
}

function inferTags(text: string, fileName: string) {
  const haystack = `${fileName} ${text}`.toLowerCase();
  const tags = new Set<string>();
  ["flat", "pitched", "slate", "tile", "fascia", "soffit", "gutter", "chimney", "lead", "epdm", "grp", "felt", "velux", "scaffold"].forEach((tag) => {
    if (haystack.includes(tag)) tags.add(tag);
  });
  return Array.from(tags);
}

function findFirst(row: Record<string, string>, candidates: string[]) {
  const normalised = Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]+/g, ""), value] as const);
  for (const candidate of candidates) {
    const wanted = candidate.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const match = normalised.find(([key]) => key === wanted || key.includes(wanted));
    if (match && clean(match[1])) return clean(match[1]);
  }
  return "";
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header, index) => clean(header) || `Column ${index + 1}`);
  return rows.slice(1).map((values) =>
    headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {})
  );
}

function rowToHistoricalQuote(row: Record<string, string>, fileName: string, index: number): ParsedUploadRecord {
  const allText = Object.values(row).map(clean).filter(Boolean).join("\n");
  const title =
    findFirst(row, ["title", "quote title", "reference", "quote ref", "customer", "client", "name"]) ||
    `${fileName.replace(/\.[^.]+$/, "")} quote ${index + 1}`;
  const content =
    findFirst(row, ["content", "quote copy", "description", "scope", "scope of works", "works", "notes", "imported text"]) ||
    allText;
  const total = parseMoney(findFirst(row, ["total", "price", "amount", "value", "quote total", "grand total"])) ?? parseMoney(allText);
  const sourceDate = parseDate(findFirst(row, ["date", "quote date", "created", "sent date"]));
  const sourceYear = parseYear(findFirst(row, ["year", "date", "quote date"])) ?? parseYear(allText);
  const roofType = findFirst(row, ["roof type"]) || inferRoofType(allText);
  const jobType = findFirst(row, ["job type", "work type"]) || inferJobType(allText);
  const rowTags = findFirst(row, ["tags", "tag"])
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const tags = Array.from(new Set([...rowTags, ...inferTags(allText, fileName)]));

  return {
    recordType: "historical_quote",
    title,
    content,
    tags,
    category: "Historical Quote",
    sourceReference: findFirst(row, ["quote ref", "reference", "ref"]) || title,
    sourceDate,
    sourceYear,
    roofType: roofType || null,
    jobType: jobType || null,
    originalTotal: total,
    scopeExcerpt: content.slice(0, 700) || null,
    materialsExcerpt: allText.match(/\b(tile|slate|felt|epdm|grp|lead|batten|membrane|ridge|valley|gutter|fascia)\b[\s\S]{0,240}/i)?.[0] ?? null
  };
}

function splitTextIntoQuoteBlocks(text: string) {
  const normalised = text.replace(/\r\n/g, "\n").trim();
  if (!normalised) return [];
  const blocks = normalised
    .split(/\n(?=(?:quote|quotation|estimate|ref|customer|client)\b[:\s-])/i)
    .map((block) => block.trim())
    .filter((block) => block.length > 80);
  return blocks.length > 1 ? blocks : [normalised];
}

function textBlockToRecord(block: string, fileName: string, index: number): ParsedUploadRecord {
  const lines = block.split("\n").map(clean).filter(Boolean);
  const firstMeaningfulLine = lines.find((line) => !/^[-=_ ]+$/.test(line));
  const total = parseMoney(block.match(/(?:total|price|amount|quote)\s*[:\-]?\s*(?:£|gbp)?\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/i)?.[0] ?? block);
  const title = firstMeaningfulLine?.slice(0, 110) || `${fileName.replace(/\.[^.]+$/, "")} quote ${index + 1}`;

  return {
    recordType: total ? "historical_quote" : "knowledge_base",
    title,
    content: block,
    tags: inferTags(block, fileName),
    category: total ? "Historical Quote" : "Scope Of Works",
    sourceReference: title,
    sourceDate: parseDate(block),
    sourceYear: parseYear(block),
    roofType: inferRoofType(block),
    jobType: inferJobType(block),
    originalTotal: total,
    scopeExcerpt: block.slice(0, 700),
    materialsExcerpt: block.match(/\b(tile|slate|felt|epdm|grp|lead|batten|membrane|ridge|valley|gutter|fascia)\b[\s\S]{0,240}/i)?.[0] ?? null
  };
}

export function canExtractFileText(fileName: string) {
  return TEXT_EXTENSIONS.includes(getExtension(fileName));
}

export function createSourceRecordId(fileName: string, record: ParsedUploadRecord, index: number) {
  return `upload:${hashSource(`${fileName}:${index}:${record.sourceReference}:${record.content.slice(0, 200)}`)}`;
}

export async function parseKnowledgeUpload(file: File): Promise<ParsedUpload> {
  const extension = getExtension(file.name);
  if (!TEXT_EXTENSIONS.includes(extension)) {
    return {
      records: [],
      warning: `${file.name} was uploaded, but this version can only read CSV, TXT, MD and JSON text files.`
    };
  }

  const text = await file.text();
  if (!text.trim()) {
    return { records: [], warning: `${file.name} had no readable text.` };
  }

  if (extension === ".csv") {
    const rows = parseCsvRows(text);
    if (rows.length === 0) {
      return { records: [], warning: `${file.name} did not contain usable CSV rows.` };
    }
    return { records: rows.map((row, index) => rowToHistoricalQuote(row, file.name, index)) };
  }

  if (extension === ".json") {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed ? Object.values(parsed as Record<string, unknown>).filter((item) => typeof item === "object") : [];
    if (rows.length > 0) {
      return {
        records: rows.map((row, index) => rowToHistoricalQuote(row as Record<string, string>, file.name, index))
      };
    }
  }

  return {
    records: splitTextIntoQuoteBlocks(text).map((block, index) => textBlockToRecord(block, file.name, index))
  };
}

