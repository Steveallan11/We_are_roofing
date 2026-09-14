import fs from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = "C:/Users/leona/Downloads/we_are_roofing_quote_knowledge_export.csv";
const OUTPUT_DIR = "C:/Users/leona/Documents/Roofing Assistant Ai/we are roofing/branding-source/outputs/quote-import";
const BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  const normalizedHeaders = headers.map((header) => String(header || "").replace(/^\uFEFF/, "").trim());
  return dataRows
    .filter((cols) => cols.some((col) => String(col ?? "").trim().length > 0))
    .map((cols) =>
      Object.fromEntries(normalizedHeaders.map((header, idx) => [header, String(cols[idx] ?? "").trim()]))
    );
}

function normalizeText(value) {
  return String(value || "")
    .replaceAll("Â£", "£")
    .replaceAll("â€”", "—")
    .replaceAll("â€“", "–")
    .replaceAll("â€™", "’")
    .replaceAll("â€œ", "“")
    .replaceAll("â€", "”")
    .replaceAll("â€˜", "‘")
    .replaceAll("â€¦", "…")
    .replaceAll("Ã—", "×")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function parseNumber(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[£,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (!value) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function extractYear(value, fallbackDate) {
  if (fallbackDate) {
    return Number(fallbackDate.slice(0, 4));
  }
  const match = /(\d{4})/.exec(value || "");
  return match ? Number(match[1]) : null;
}

function normalizeTags(value) {
  const seen = new Set();
  return normalizeText(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/\s+/g, " "))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function inferRoofType(row, tags) {
  const haystack = normalizeText(`${row.roof_type} ${row.job_category_summary} ${tags.join(" ")}`).toLowerCase();
  if (haystack.includes("flat")) return "Flat";
  if (haystack.includes("slate")) return "Slate";
  if (haystack.includes("tile")) return "Tile";
  if (haystack.includes("pitched")) return "Pitched";
  if (haystack.includes("fascia") || haystack.includes("soffit") || haystack.includes("gutter")) return "Fascia";
  if (haystack.includes("chimney") || haystack.includes("lead")) return "Chimney";
  return null;
}

function inferJobType(row) {
  const summary = normalizeText(row.job_category_summary || "");
  return summary || null;
}

function shouldExclude(row) {
  const text = [
    row.source_ref,
    row.problem_diagnosis,
    row.recommended_scope,
    row.job_category_summary,
    row.current_pricing_use
  ]
    .map(normalizeText)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("not relevant") ||
    text.includes("do not add") ||
    text.includes("keep out of quote brain") ||
    text.includes("non-quoting/admin/personal") ||
    text.includes("non-roofing document")
  );
}

function mapKnowledgeCategory(row) {
  const sourceType = String(row.source_type || "").toLowerCase();
  const summary = String(row.job_category_summary || "").toLowerCase();
  const scope = String(row.recommended_scope || "").toLowerCase();

  if (sourceType.includes("template")) return "Quote Template";
  if (sourceType.includes("supplier")) return "Supplier Info";
  if (sourceType.includes("guarantee")) {
    if (scope.includes("guarantee")) return "Terms";
    return "Materials System";
  }
  if (sourceType.includes("roof report")) return "Roof Report Style";
  if (summary.includes("pricing") || row.price_anchor_first_gbp) return "Pricing Reference";
  return "Scope Of Works";
}

function buildHistoricalQuote(row) {
  const tags = normalizeTags(row.job_category_tags);
  const sourceDate = parseDate(row.source_date);
  const sourceYear = extractYear(row.year_band, sourceDate);
  const originalTotal = parseNumber(row.price_anchor_first_gbp) ?? parseNumber(row.all_price_values_gbp);
  const baseRef = normalizeText(row.estimate_number || row.source_ref || row.search_keywords || row.job_category_summary || "untitled-record");
  const importedText = [
    row.problem_diagnosis ? `Problem / Diagnosis: ${normalizeText(row.problem_diagnosis)}` : "",
    row.recommended_scope ? `Recommended Scope: ${normalizeText(row.recommended_scope)}` : "",
    row.system_materials ? `Materials / System: ${normalizeText(row.system_materials)}` : "",
    row.ai_quote_notes ? `AI Quote Notes: ${normalizeText(row.ai_quote_notes)}` : "",
    row.add_ons_exclusions_flags ? `Add-ons / Exclusions: ${normalizeText(row.add_ons_exclusions_flags)}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    business_id: BUSINESS_ID,
    title: normalizeText(row.source_ref || row.estimate_number || baseRef),
    source_reference: normalizeText(row.estimate_number || row.source_ref || baseRef),
    source_record_id: `csv:${baseRef.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    source_url: null,
    source_type: "csv_import",
    source_date: sourceDate,
    source_year: sourceYear,
    roof_type: inferRoofType(row, tags),
    job_type: inferJobType(row),
    tags,
    imported_text: importedText || row.recommended_scope || row.problem_diagnosis || row.source_ref,
    scope_excerpt: normalizeText(row.recommended_scope) || null,
    materials_excerpt: normalizeText(row.system_materials) || null,
    original_total: originalTotal,
    uplifted_reference_total: null
  };
}

function buildKnowledgeRecord(row) {
  const tags = normalizeTags(row.job_category_tags);
  const content = [
    row.problem_diagnosis ? `Problem / Diagnosis: ${normalizeText(row.problem_diagnosis)}` : "",
    row.recommended_scope ? `Recommended Scope: ${normalizeText(row.recommended_scope)}` : "",
    row.system_materials ? `Materials / System: ${normalizeText(row.system_materials)}` : "",
    row.ai_quote_notes ? `AI Quote Notes: ${normalizeText(row.ai_quote_notes)}` : "",
    row.current_pricing_use ? `Current Pricing Use: ${normalizeText(row.current_pricing_use)}` : "",
    row.year_band ? `Year Band: ${normalizeText(row.year_band)}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    business_id: BUSINESS_ID,
    title: normalizeText(row.source_ref || row.estimate_number || row.job_category_summary || "Untitled knowledge record"),
    category: mapKnowledgeCategory(row),
    content,
    source_type: "csv_import",
    tags
  };
}

function toSqlLiteral(value) {
  if (value == null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (Array.isArray(value)) return `'${escapeSql(JSON.stringify(value))}'::jsonb`;
  return `'${escapeSql(value)}'`;
}

function buildSql(historicalQuotes, knowledgeBase) {
  const historicalValues = historicalQuotes
    .map(
      (row) => `(
  ${toSqlLiteral(row.business_id)},
  ${toSqlLiteral(row.title)},
  ${toSqlLiteral(row.source_reference)},
  ${toSqlLiteral(row.source_record_id)},
  ${toSqlLiteral(row.source_url)},
  ${toSqlLiteral(row.source_type)},
  ${toSqlLiteral(row.source_date)},
  ${toSqlLiteral(row.source_year)},
  ${toSqlLiteral(row.roof_type)},
  ${toSqlLiteral(row.job_type)},
  ${toSqlLiteral(row.tags)},
  ${toSqlLiteral(row.imported_text)},
  ${toSqlLiteral(row.scope_excerpt)},
  ${toSqlLiteral(row.materials_excerpt)},
  ${toSqlLiteral(row.original_total)},
  ${toSqlLiteral(row.uplifted_reference_total)}
)`
    )
    .join(",\n");

  const knowledgeValues = knowledgeBase
    .map(
      (row) => `(
  ${toSqlLiteral(row.business_id)},
  ${toSqlLiteral(row.title)},
  ${toSqlLiteral(row.category)},
  ${toSqlLiteral(row.content)},
  ${toSqlLiteral(row.source_type)},
  ${toSqlLiteral(row.tags)}
)`
    )
    .join(",\n");

  return `-- We Are Roofing CSV import pack
-- Generated from we_are_roofing_quote_knowledge_export.csv

with incoming_historical_quotes (
  business_id,
  title,
  source_reference,
  source_record_id,
  source_url,
  source_type,
  source_date,
  source_year,
  roof_type,
  job_type,
  tags,
  imported_text,
  scope_excerpt,
  materials_excerpt,
  original_total,
  uplifted_reference_total
) as (
  values
${historicalValues}
)
insert into historical_quotes (
  business_id,
  title,
  source_reference,
  source_record_id,
  source_url,
  source_type,
  source_date,
  source_year,
  roof_type,
  job_type,
  tags,
  imported_text,
  scope_excerpt,
  materials_excerpt,
  original_total,
  uplifted_reference_total
)
select
  ihq.business_id,
  ihq.title,
  ihq.source_reference,
  ihq.source_record_id,
  ihq.source_url,
  ihq.source_type,
  ihq.source_date,
  ihq.source_year,
  ihq.roof_type,
  ihq.job_type,
  ihq.tags,
  ihq.imported_text,
  ihq.scope_excerpt,
  ihq.materials_excerpt,
  ihq.original_total,
  ihq.uplifted_reference_total
from incoming_historical_quotes ihq
where not exists (
  select 1
  from historical_quotes hq
  where hq.business_id = ihq.business_id
    and (
      lower(coalesce(hq.source_reference, '')) = lower(coalesce(ihq.source_reference, ''))
      or lower(coalesce(hq.title, '')) = lower(coalesce(ihq.title, ''))
      or lower(coalesce(hq.source_record_id, '')) = lower(coalesce(ihq.source_record_id, ''))
    )
);

with incoming_knowledge_base (
  business_id,
  title,
  category,
  content,
  source_type,
  tags
) as (
  values
${knowledgeValues}
)
insert into knowledge_base (
  business_id,
  title,
  category,
  content,
  source_type,
  tags
)
select
  ikb.business_id,
  ikb.title,
  ikb.category,
  ikb.content,
  ikb.source_type,
  ikb.tags
from incoming_knowledge_base ikb
where not exists (
  select 1
  from knowledge_base kb
  where kb.business_id = ikb.business_id
    and lower(coalesce(kb.title, '')) = lower(coalesce(ikb.title, ''))
    and lower(coalesce(kb.category::text, '')) = lower(coalesce(ikb.category, ''))
);
`;
}

function buildHistoricalSql(historicalQuotes) {
  const historicalValues = historicalQuotes
    .map(
      (row) => `(
  ${toSqlLiteral(row.business_id)},
  ${toSqlLiteral(row.title)},
  ${toSqlLiteral(row.source_reference)},
  ${toSqlLiteral(row.source_record_id)},
  ${toSqlLiteral(row.source_url)},
  ${toSqlLiteral(row.source_type)},
  ${toSqlLiteral(row.source_date)},
  ${toSqlLiteral(row.source_year)},
  ${toSqlLiteral(row.roof_type)},
  ${toSqlLiteral(row.job_type)},
  ${toSqlLiteral(row.tags)},
  ${toSqlLiteral(row.imported_text)},
  ${toSqlLiteral(row.scope_excerpt)},
  ${toSqlLiteral(row.materials_excerpt)},
  ${toSqlLiteral(row.original_total)},
  ${toSqlLiteral(row.uplifted_reference_total)}
)`
    )
    .join(",\n");

  return `with incoming_historical_quotes (
  business_id,
  title,
  source_reference,
  source_record_id,
  source_url,
  source_type,
  source_date,
  source_year,
  roof_type,
  job_type,
  tags,
  imported_text,
  scope_excerpt,
  materials_excerpt,
  original_total,
  uplifted_reference_total
) as (
  values
${historicalValues}
)
insert into historical_quotes (
  business_id,
  title,
  source_reference,
  source_record_id,
  source_url,
  source_type,
  source_date,
  source_year,
  roof_type,
  job_type,
  tags,
  imported_text,
  scope_excerpt,
  materials_excerpt,
  original_total,
  uplifted_reference_total
)
select
  ihq.business_id,
  ihq.title,
  ihq.source_reference,
  ihq.source_record_id,
  ihq.source_url,
  ihq.source_type,
  ihq.source_date,
  ihq.source_year,
  ihq.roof_type,
  ihq.job_type,
  ihq.tags,
  ihq.imported_text,
  ihq.scope_excerpt,
  ihq.materials_excerpt,
  ihq.original_total,
  ihq.uplifted_reference_total
from incoming_historical_quotes ihq
where not exists (
  select 1
  from historical_quotes hq
  where hq.business_id = ihq.business_id
    and (
      lower(coalesce(hq.source_reference, '')) = lower(coalesce(ihq.source_reference, ''))
      or lower(coalesce(hq.title, '')) = lower(coalesce(ihq.title, ''))
      or lower(coalesce(hq.source_record_id, '')) = lower(coalesce(ihq.source_record_id, ''))
    )
);
`;
}

function buildKnowledgeSql(knowledgeBase) {
  const knowledgeValues = knowledgeBase
    .map(
      (row) => `(
  ${toSqlLiteral(row.business_id)},
  ${toSqlLiteral(row.title)},
  ${toSqlLiteral(row.category)},
  ${toSqlLiteral(row.content)},
  ${toSqlLiteral(row.source_type)},
  ${toSqlLiteral(row.tags)}
)`
    )
    .join(",\n");

  return `with incoming_knowledge_base (
  business_id,
  title,
  category,
  content,
  source_type,
  tags
) as (
  values
${knowledgeValues}
)
insert into knowledge_base (
  business_id,
  title,
  category,
  content,
  source_type,
  tags
)
select
  ikb.business_id,
  ikb.title,
  ikb.category,
  ikb.content,
  ikb.source_type,
  ikb.tags
from incoming_knowledge_base ikb
where not exists (
  select 1
  from knowledge_base kb
  where kb.business_id = ikb.business_id
    and lower(coalesce(kb.title, '')) = lower(coalesce(ikb.title, ''))
    and lower(coalesce(kb.category::text, '')) = lower(coalesce(ikb.category, ''))
);
`;
}

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  const csvText = await fs.readFile(INPUT_PATH, "utf8");
  const rows = parseCsv(csvText);

  const filtered = rows.filter((row) => !shouldExclude(row));
  const estimateRows = filtered.filter((row) => row.source_type === "Estimate");
  const knowledgeRows = filtered.filter((row) => row.source_type !== "Estimate");

  const historicalQuotes = estimateRows.map(buildHistoricalQuote);
  const knowledgeBase = knowledgeRows.map(buildKnowledgeRecord);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, "historical_quotes.cleaned.json"), JSON.stringify(historicalQuotes, null, 2));
  await fs.writeFile(path.join(OUTPUT_DIR, "knowledge_base.cleaned.json"), JSON.stringify(knowledgeBase, null, 2));
  await fs.writeFile(path.join(OUTPUT_DIR, "supabase_import.sql"), buildSql(historicalQuotes, knowledgeBase));
  await fs.writeFile(path.join(OUTPUT_DIR, "historical_quotes_import.sql"), buildHistoricalSql(historicalQuotes));
  await fs.writeFile(path.join(OUTPUT_DIR, "knowledge_base_import.sql"), buildKnowledgeSql(knowledgeBase));
  const batches = chunk(historicalQuotes, 40);
  await Promise.all(
    batches.map((batch, idx) =>
      fs.writeFile(path.join(OUTPUT_DIR, `historical_quotes_import_part_${idx + 1}.sql`), buildHistoricalSql(batch))
    )
  );
  await fs.writeFile(
    path.join(OUTPUT_DIR, "import_summary.json"),
    JSON.stringify(
      {
        input_rows: rows.length,
        excluded_rows: rows.length - filtered.length,
        historical_quotes_rows: historicalQuotes.length,
        knowledge_base_rows: knowledgeBase.length,
        excluded_examples: rows.filter(shouldExclude).slice(0, 20).map((row) => ({
          source_ref: row.source_ref,
          source_type: row.source_type
        }))
      },
      null,
      2
    )
  );
}

await main();
