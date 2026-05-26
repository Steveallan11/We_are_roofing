import type {
  CostLineItem,
  HistoricalQuoteRecord,
  JobBundle,
  PricingRuleRecord,
  QuoteOption,
  QuoteRecord
} from "@/lib/types";
import { getOptionTotal, getQuotePipelineValue, isQuoteFromOptionValue } from "@/lib/quotes/value";
import { getStoragePublicUrl, JOB_DOCUMENTS_BUCKET, ensurePublicStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function scoreHistoricalQuote(bundle: JobBundle, record: HistoricalQuoteRecord) {
  let score = 0;
  const roofType = bundle.job.roof_type?.toLowerCase();
  const jobType = bundle.job.job_type?.toLowerCase();

  if (roofType && record.roof_type?.toLowerCase() === roofType) score += 4;
  if (jobType && record.job_type?.toLowerCase() === jobType) score += 3;

  const haystack = [record.title, record.imported_text, record.scope_excerpt, ...(record.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (roofType && haystack.includes(roofType)) score += 2;
  if (jobType && haystack.includes(jobType)) score += 1;
  if (bundle.survey?.problem_observed && haystack.includes(bundle.survey.problem_observed.toLowerCase().split(" ")[0] ?? "")) score += 1;

  return score;
}

export function applyPricingRules(
  historicalQuotes: HistoricalQuoteRecord[],
  pricingRules: PricingRuleRecord[],
  bundle?: JobBundle
) {
  return historicalQuotes.map((record) => {
    const rule = pricingRules.find((candidate) => {
      const withinYear =
        record.source_year == null ||
        ((candidate.year_from == null || record.source_year >= candidate.year_from) &&
          (candidate.year_to == null || record.source_year <= candidate.year_to));
      const roofMatch =
        !candidate.roof_type ||
        !bundle?.job.roof_type ||
        candidate.roof_type.toLowerCase() === bundle.job.roof_type.toLowerCase();
      const jobMatch =
        !candidate.job_type ||
        !bundle?.job.job_type ||
        candidate.job_type.toLowerCase() === bundle.job.job_type.toLowerCase();
      return withinYear && roofMatch && jobMatch;
    });

    const multiplier = rule?.uplift_multiplier ?? 1;
    const uplifted =
      record.original_total != null ? Math.round(record.original_total * multiplier * 100) / 100 : record.uplifted_reference_total ?? null;

    return {
      ...record,
      uplifted_reference_total: uplifted
    };
  });
}

export function getComparableHistoricalQuotes(
  bundle: JobBundle,
  historicalQuotes: HistoricalQuoteRecord[],
  pricingRules: PricingRuleRecord[],
  limit = 5
) {
  return applyPricingRules(historicalQuotes, pricingRules, bundle)
    .map((record) => ({ record, score: scoreHistoricalQuote(bundle, record) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.record);
}

export function buildQuoteDocumentHtml(bundle: JobBundle, quote: QuoteRecord) {
  const logoUrl = resolveAssetUrl(bundle.business.logo_url || "/we-are-roofing-logo.png");
  const visibleLineItems = quote.cost_breakdown.filter((line) => Number(line.cost ?? 0) > 0);
  const options = ((quote.options ?? []) as QuoteOption[]).filter((option) => Number(option.total ?? 0) > 0 || option.cost_breakdown?.length);
  const displayTotal = getQuotePipelineValue(quote) ?? 0;
  const rows = visibleLineItems
    .map(
      (line) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;">
            <strong>${escapeHtml(line.quote_section || line.item)}</strong>
            ${line.quote_section ? `<br/><span style="font-size:12px;color:#75663b;">${escapeHtml(line.item)}</span>` : ""}
          </td>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;line-height:1.55;">
            ${line.measurement_label ? `<strong>${escapeHtml(line.measurement_label)}</strong><br/>` : ""}
            ${escapeHtml(formatLineNotes(line))}
          </td>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;text-align:right;">${formatCurrency(line.cost)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(quote.quote_ref)}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; background:#f3f0e4; color:#101010; padding:40px; }
      .sheet { max-width: 900px; margin: 0 auto; background:#ffffff; border:1px solid #d8c58a; border-radius:22px; overflow:hidden; }
      .hero { background:#101417; color:#f5e7b2; padding:34px 38px; }
      .hero img { max-width:180px; display:block; margin-bottom:18px; }
      .hero h1 { margin:0; font-size:38px; line-height:1; }
      .hero p { margin:10px 0 0; color:#d7c483; font-size:16px; line-height:1.6; }
      .body { padding:34px 38px; }
      h2 { font-size:19px; margin:28px 0 12px; color:#101417; text-transform:uppercase; letter-spacing:0.08em; }
      p { line-height:1.75; font-size:16px; }
      .readable p { margin:0 0 14px; }
      table { width:100%; border-collapse:collapse; margin-top:12px; }
      th { text-align:left; padding:12px; border-bottom:2px solid #101417; text-transform:uppercase; font-size:12px; letter-spacing:0.08em; }
      td { font-size:15px; }
      .totals { margin-top:22px; margin-left:auto; width:min(320px,100%); }
      .totals div { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e5ddbf; }
      .totals div:last-child { border-bottom:none; font-size:20px; font-weight:700; color:#8d6a00; }
      .meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:18px; }
      .meta-card { background:#f7f3e3; padding:12px 14px; border-radius:14px; }
      .meta-label { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#75663b; margin-bottom:6px; }
      .guide { background:#fbf6e8; border:1px solid #e5ddbf; border-left:4px solid #d4af37; border-radius:14px; padding:18px 20px; margin:24px 0 4px; }
      .guide-title { margin:0 0 8px; color:#8d6a00; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="hero">
        <img src="${logoUrl}" alt="We Are Roofing UK Ltd" />
        <h1>${escapeHtml(bundle.business.business_name)}</h1>
        <p>${escapeHtml(bundle.business.trading_address || "")}</p>
      </div>
      <div class="body">
        <div class="meta">
          <div class="meta-card"><div class="meta-label">Quote Ref</div><div>${escapeHtml(quote.quote_ref)}</div></div>
          <div class="meta-card"><div class="meta-label">Customer</div><div>${escapeHtml(bundle.customer.full_name)}</div></div>
          <div class="meta-card"><div class="meta-label">Property</div><div>${escapeHtml(bundle.job.property_address)}</div></div>
          <div class="meta-card"><div class="meta-label">Roof Type</div><div>${escapeHtml(bundle.job.roof_type || "Roofing")}</div></div>
        </div>
        <div class="guide">
          <div class="guide-title">How to read this quote</div>
          <p style="margin:0;">This quotation is split into the roof report, the proposed works, and the priced sections. Measurements from the takeoff are shown next to the relevant price lines where available.</p>
        </div>
        <h2>Roof Report</h2>
        <div class="readable">${renderReadableHtml(quote.roof_report)}</div>
        <h2>Scope of Works</h2>
        <div class="readable">${renderReadableHtml(quote.scope_of_works)}</div>
        ${
          options.length
            ? `<h2>Quote Options</h2>${options.map(renderOptionHtml).join("")}`
            : `<h2>Cost Breakdown</h2>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Notes</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>${
                  rows ||
                  `<tr><td colspan="3" style="padding:12px;border-bottom:1px solid #d8c58a;color:#75663b;text-align:center;">No priced line items are ready to show yet.</td></tr>`
                }</tbody>
              </table>
              <div class="totals">
                <div><span>Subtotal</span><span>${formatCurrency(quote.subtotal)}</span></div>
                <div><span>VAT</span><span>${formatCurrency(quote.vat_amount)}</span></div>
                <div><span>${isQuoteFromOptionValue(quote) ? "From" : "Total"}</span><span>${formatCurrency(displayTotal)}</span></div>
              </div>`
        }
        <h2>Guarantee</h2>
        <div class="readable">${renderReadableHtml(quote.guarantee_text || "")}</div>
        <h2>Exclusions</h2>
        <div class="readable">${renderReadableHtml(quote.exclusions || "")}</div>
        <h2>Terms</h2>
        <div class="readable">${renderReadableHtml(quote.terms || "")}</div>
      </div>
    </div>
  </body>
</html>`;
}

function renderOptionHtml(option: QuoteOption) {
  const lines = (option.cost_breakdown ?? []).filter((line) => Number(line.cost ?? 0) > 0);
  const lineRows = lines.map(renderCostLineRow).join("");

  return `<section style="border:2px solid ${option.recommended ? "#d4af37" : "#e5ddbf"};border-radius:16px;margin:16px 0;padding:18px 20px;">
    ${option.recommended ? `<div style="color:#8d6a00;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Recommended</div>` : ""}
    <h3 style="font-size:24px;margin:6px 0 6px;">${escapeHtml(option.label)}</h3>
    <div class="readable">${renderReadableHtml(option.description || "")}</div>
    <table>
      <thead>
        <tr>
          <th>Option item</th>
          <th>Notes</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${
        lineRows ||
        `<tr><td colspan="3" style="padding:12px;border-bottom:1px solid #d8c58a;color:#75663b;text-align:center;">No priced line items are ready to show for this option.</td></tr>`
      }</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${formatCurrency(option.subtotal)}</span></div>
      <div><span>VAT</span><span>${formatCurrency(option.vat_amount)}</span></div>
      <div><span>Total</span><span>${formatCurrency(getOptionTotal(option) ?? 0)}</span></div>
    </div>
  </section>`;
}

function renderCostLineRow(line: CostLineItem) {
  return `<tr>
    <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;">
      <strong>${escapeHtml(line.quote_section || line.item)}</strong>
      ${line.quote_section ? `<br/><span style="font-size:12px;color:#75663b;">${escapeHtml(line.item)}</span>` : ""}
    </td>
    <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;line-height:1.55;">
      ${line.measurement_label ? `<strong>${escapeHtml(line.measurement_label)}</strong><br/>` : ""}
      ${escapeHtml(formatLineNotes(line))}
    </td>
    <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;text-align:right;">${formatCurrency(line.cost)}</td>
  </tr>`;
}

export function buildQuotePdfBuffer(bundle: JobBundle, quote: QuoteRecord) {
  const displayTotal = getQuotePipelineValue(quote) ?? 0;
  const lines = [
    bundle.business.business_name,
    bundle.business.trading_address || "",
    "",
    `Quote Ref: ${quote.quote_ref}`,
    `Customer: ${bundle.customer.full_name}`,
    `Property: ${bundle.job.property_address}`,
    "",
    "Roof Report",
    ...wrapText(quote.roof_report),
    "",
    "Scope of Works",
    ...wrapText(quote.scope_of_works),
    "",
    "Cost Breakdown"
  ];

  for (const item of quote.cost_breakdown.filter((line) => Number(line.cost ?? 0) > 0)) {
    lines.push(`${item.quote_section || item.item} - ${item.measurement_label ? `${item.measurement_label} - ` : ""}${formatCurrency(item.cost)}`);
    if (item.quote_section) {
      lines.push(...wrapText(`  ${item.item}`));
    }
    if (item.notes) {
      lines.push(...wrapText(`  ${item.notes}`));
    }
  }

  lines.push(
    "",
    `Subtotal: ${formatCurrency(quote.subtotal)}`,
    `VAT: ${formatCurrency(quote.vat_amount)}`,
    `${isQuoteFromOptionValue(quote) ? "From" : "Total"}: ${formatCurrency(displayTotal)}`,
    "",
    "Guarantee",
    ...wrapText(quote.guarantee_text || ""),
    "",
    "Exclusions",
    ...wrapText(quote.exclusions || ""),
    "",
    "Terms",
    ...wrapText(quote.terms || "")
  );

  const commands: string[] = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL"];
  for (const line of lines) {
    commands.push(`(${escapePdf(line)}) Tj`, "T*");
  }
  commands.push("ET");
  const stream = commands.join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }
  const xrefPosition = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export async function persistQuoteArtifacts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bundle: JobBundle,
  quote: QuoteRecord
) {
  const timestamp = Date.now();
  const basePath = `${bundle.job.id}/quotes/${quote.id}`;
  const htmlPath = `${basePath}/${quote.quote_ref.toLowerCase()}-${timestamp}.html`;
  const pdfPath = `${basePath}/${quote.quote_ref.toLowerCase()}-${timestamp}.pdf`;
  const html = buildQuoteDocumentHtml(bundle, quote);
  const pdf = buildQuotePdfBuffer(bundle, quote);

  let htmlUrl: string | null = null;
  let pdfUrl: string | null = null;
  let bucketError: string | null = null;
  let htmlError: string | null = null;
  let pdfError: string | null = null;

  const bucketResult = await ensurePublicStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
  if (!bucketResult.ok) {
    bucketError = bucketResult.error;
    htmlError = bucketError;
    pdfError = bucketError;
  } else {
    const htmlUpload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(htmlPath, Buffer.from(html, "utf8"), {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });
    if (htmlUpload.error) {
      htmlError = htmlUpload.error.message;
    } else {
      htmlUrl = getStoragePublicUrl(supabase, JOB_DOCUMENTS_BUCKET, htmlPath);
      if (!htmlUrl) {
        htmlError = "HTML snapshot uploaded, but no public URL could be generated.";
      }
    }

    const pdfUpload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(pdfPath, pdf, {
      contentType: "application/pdf",
      upsert: true
    });
    if (pdfUpload.error) {
      pdfError = pdfUpload.error.message;
    } else {
      pdfUrl = getStoragePublicUrl(supabase, JOB_DOCUMENTS_BUCKET, pdfPath);
      if (!pdfUrl) {
        pdfError = "PDF uploaded, but no public URL could be generated.";
      }
    }
  }

  const [{ data: existingHtml }, { data: existingPdf }] = await Promise.all([
    supabase
      .from("job_documents")
      .select("id")
      .eq("quote_id", quote.id)
      .eq("document_type", "quote_html")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("job_documents")
      .select("id")
      .eq("quote_id", quote.id)
      .eq("document_type", "quote_pdf")
      .limit(1)
      .maybeSingle()
  ]);

  const htmlPayload = {
    job_id: bundle.job.id,
    quote_id: quote.id,
    document_type: "quote_html",
    display_name: `${quote.quote_ref} HTML Snapshot`,
    storage_bucket: htmlUrl ? JOB_DOCUMENTS_BUCKET : null,
    storage_path: htmlUrl ? htmlPath : null,
    public_url: htmlUrl,
    source_type: "generated",
    mime_type: "text/html",
    file_size: Buffer.byteLength(html, "utf8"),
    content_html: html
  };

  const pdfPayload = {
    job_id: bundle.job.id,
    quote_id: quote.id,
    document_type: "quote_pdf",
    display_name: `${quote.quote_ref}.pdf`,
    storage_bucket: pdfUrl ? JOB_DOCUMENTS_BUCKET : null,
    storage_path: pdfUrl ? pdfPath : null,
    public_url: pdfUrl,
    source_type: "generated",
    mime_type: "application/pdf",
    file_size: pdf.length,
    content_html: null
  };

  await Promise.all([
    existingHtml?.id
      ? supabase.from("job_documents").update(htmlPayload).eq("id", existingHtml.id)
      : supabase.from("job_documents").insert(htmlPayload),
    existingPdf?.id
      ? supabase.from("job_documents").update(pdfPayload).eq("id", existingPdf.id)
      : supabase.from("job_documents").insert(pdfPayload)
  ]);

  if (pdfUrl) {
    await supabase
      .from("quotes")
      .update({
        pdf_url: pdfUrl,
        updated_at: new Date().toISOString()
      })
      .eq("id", quote.id);
  }

  return { htmlUrl, pdfUrl, html, pdf, bucketError, htmlError, pdfError };
}

function wrapText(text: string, maxLength = 92) {
  if (!text) return [""];
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current.length) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length > maxLength) {
      lines.push(current);
      current = word;
      continue;
    }
    current = `${current} ${word}`;
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function renderReadableHtml(value: string) {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (!text) return "<p>To be confirmed.</p>";

  return text
    .split(/\n{2,}/)
    .map((block) => block.trim().replace(/\n/g, " "))
    .filter(Boolean)
    .flatMap(splitLongHtmlParagraph)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function splitLongHtmlParagraph(text: string) {
  if (text.length < 340) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  const paragraphs: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 280 && current) {
      paragraphs.push(current);
      current = sentence;
      continue;
    }
    current = next;
  }

  if (current) paragraphs.push(current);
  return paragraphs;
}

function formatLineNotes(line: QuoteRecord["cost_breakdown"][number]) {
  return [line.quote_section ? line.item : null, line.notes].filter(Boolean).join(" - ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapePdf(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(value);
}

function resolveAssetUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}
