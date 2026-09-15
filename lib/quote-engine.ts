import type {
  CostLineItem,
  HistoricalQuoteRecord,
  JobBundle,
  PricingRuleRecord,
  QuoteOption,
  QuoteRecord
} from "@/lib/types";
import { getDocumentFileHref, getQuotePdfHref } from "@/lib/documents";
import { formatLineAmountForDisplay, getOptionTotal, getQuotePipelineValue, isQuoteFromOptionValue } from "@/lib/quotes/value";
import { JOB_DOCUMENTS_BUCKET, ensurePrivateStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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
            <strong>${escapeHtml(customerFacingLabel(line.quote_section || line.item))}</strong>
            ${line.quote_section ? `<br/><span style="font-size:12px;color:#75663b;">${escapeHtml(line.item)}</span>` : ""}
          </td>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;line-height:1.55;">
            ${line.measurement_label ? `<strong>${escapeHtml(line.measurement_label)}</strong><br/>` : ""}
            ${escapeHtml(formatLineNotes(line))}
          </td>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;text-align:right;">${escapeHtml(formatLineAmountForDisplay(line))}</td>
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
      <strong>${escapeHtml(customerFacingLabel(line.quote_section || line.item))}</strong>
      ${line.quote_section ? `<br/><span style="font-size:12px;color:#75663b;">${escapeHtml(line.item)}</span>` : ""}
    </td>
    <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;line-height:1.55;">
      ${line.measurement_label ? `<strong>${escapeHtml(line.measurement_label)}</strong><br/>` : ""}
      ${escapeHtml(formatLineNotes(line))}
    </td>
    <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;text-align:right;">${escapeHtml(formatLineAmountForDisplay(line))}</td>
  </tr>`;
}

export async function buildQuotePdfBuffer(bundle: JobBundle, quote: QuoteRecord) {
  const displayTotal = getQuotePipelineValue(quote) ?? 0;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const colours = { dark: rgb(0.07, 0.08, 0.09), gold: rgb(0.73, 0.55, 0.13), pale: rgb(0.98, 0.96, 0.89), rule: rgb(0.86, 0.82, 0.69), muted: rgb(0.38, 0.38, 0.36), white: rgb(1, 1, 1) };
  const margin = 48;
  let page = pdf.addPage([595, 842]);
  let y = 790;

  const addPage = () => {
    page = pdf.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 828, width: 595, height: 14, color: colours.gold });
    page.drawText(bundle.business.business_name, { x: margin, y: 800, font: bold, size: 9, color: colours.dark });
    page.drawText(quote.quote_ref, { x: 480, y: 800, font: bold, size: 9, color: colours.gold });
    y = 770;
  };
  const ensure = (height: number) => { if (y - height < 58) addPage(); };
  const text = (value: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const indent = options.indent ?? 0;
    const maxWidth = 595 - margin * 2 - indent;
    const lines = wrapPdfText(value || "To be confirmed.", font, size, maxWidth);
    ensure(lines.length * (size + 4) + (options.gap ?? 6));
    for (const line of lines) {
      page.drawText(line, { x: margin + indent, y, font, size, color: options.color ?? colours.dark });
      y -= size + 4;
    }
    y -= options.gap ?? 6;
  };
  const heading = (label: string) => {
    ensure(42);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 4, width: 5, height: 22, color: colours.gold });
    page.drawText(label.toUpperCase(), { x: margin + 14, y, font: bold, size: 15, color: colours.dark });
    y -= 30;
  };

  page.drawRectangle({ x: 0, y: 828, width: 595, height: 14, color: colours.gold });
  page.drawText(bundle.business.business_name.toUpperCase(), { x: margin, y, font: bold, size: 12, color: colours.dark });
  y -= 72;
  page.drawText("QUOTATION", { x: margin, y, font: bold, size: 34, color: colours.dark });
  y -= 32;
  text(bundle.job.job_title || "Proposed roofing works", { size: 17, font: bold, color: colours.gold, gap: 24 });
  page.drawRectangle({ x: margin, y: y - 105, width: 499, height: 112, color: colours.pale, borderColor: colours.rule, borderWidth: 1 });
  const coverRows = [
    ["QUOTE REFERENCE", quote.quote_ref],
    ["CUSTOMER", bundle.customer.full_name],
    ["SITE ADDRESS", [bundle.job.property_address, bundle.job.postcode].filter(Boolean).join(", ")],
    ["ISSUED", new Date(quote.created_at ?? new Date().toISOString()).toLocaleDateString("en-GB")]
  ];
  let coverY = y - 20;
  for (const [label, value] of coverRows) {
    page.drawText(label, { x: margin + 16, y: coverY, font: bold, size: 8, color: colours.gold });
    page.drawText(String(value || "—").slice(0, 72), { x: margin + 142, y: coverY, font: regular, size: 10, color: colours.dark });
    coverY -= 25;
  }
  y -= 140;
  heading("How to read this quote");
  text("1  Roof condition and our recommendation     2  Scope of works     3  Options and pricing     4  Guarantee, exclusions and terms", { size: 10, gap: 18 });
  text(`Prepared by ${bundle.business.business_name}. ${bundle.business.trading_address || ""}`, { size: 9, color: colours.muted });

  addPage();
  heading("Roof condition report");
  text(quote.roof_report);
  heading("Our recommendation");
  text(bundle.survey?.recommended_works || quote.scope_of_works);
  heading("Scope of works");
  text(quote.scope_of_works);

  const options = ((quote.options ?? []) as QuoteOption[]).filter((option) => Number(option.total ?? 0) > 0 || option.cost_breakdown?.length);
  heading(options.length ? "Options and pricing" : "Price summary");
  const pricedGroups = options.length ? options : [{ id: "quote", label: "Proposed works", description: "", recommended: true, cost_breakdown: quote.cost_breakdown, subtotal: quote.subtotal, vat_amount: quote.vat_amount, total: displayTotal }];
  for (const option of pricedGroups) {
    ensure(65);
    page.drawRectangle({ x: margin, y: y - 4, width: 499, height: 25, color: option.recommended ? colours.pale : colours.white, borderColor: option.recommended ? colours.gold : colours.rule, borderWidth: 1 });
    page.drawText(`${option.recommended ? "RECOMMENDED · " : ""}${option.label}`, { x: margin + 10, y: y + 4, font: bold, size: 12, color: option.recommended ? colours.gold : colours.dark });
    y -= 34;
    if (option.description) text(option.description, { size: 9 });
    for (const item of (option.cost_breakdown ?? []).filter((line) => Number(line.cost ?? 0) > 0)) {
      ensure(30);
      const label = customerFacingLabel(item.quote_section || item.item);
      page.drawText(label.slice(0, 58), { x: margin + 8, y, font: bold, size: 9, color: colours.dark });
      page.drawText(formatLineAmountForDisplay(item), { x: 475, y, font: bold, size: 9, color: colours.gold });
      y -= 13;
      if (item.quote_section) text(item.item, { size: 8, color: colours.muted, indent: 8, gap: 2 });
      page.drawLine({ start: { x: margin + 8, y }, end: { x: 547, y }, thickness: 0.5, color: colours.rule });
      y -= 9;
    }
    const optionTotal = "total" in option ? Number(option.total ?? 0) : displayTotal;
    ensure(58);
    text(`Subtotal  ${formatCurrency(Number(option.subtotal ?? 0))}     VAT  ${formatCurrency(Number(option.vat_amount ?? 0))}`, { size: 9, font: bold, gap: 2 });
    text(`TOTAL  ${formatCurrency(optionTotal)}`, { size: 15, font: bold, color: colours.gold, gap: 18 });
  }

  heading("Guarantee and acceptance");
  text(quote.guarantee_text || "Guarantee details will be confirmed in the accepted quotation.");
  ensure(74);
  page.drawRectangle({ x: margin, y: y - 48, width: 499, height: 60, color: colours.dark });
  page.drawText("READY TO PROCEED?", { x: margin + 16, y: y - 7, font: bold, size: 10, color: colours.gold });
  page.drawText("Accept using the secure email link or reply confirming approval.", { x: margin + 16, y: y - 29, font: regular, size: 10, color: colours.white });
  y -= 76;
  if (quote.exclusions) { heading("Exclusions"); text(quote.exclusions); }
  heading("Terms");
  text(quote.terms || "Terms to be confirmed.");

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => drawQuoteFooter(pdfPage, bold, regular, bundle.business.business_name, quote.quote_ref, index + 1, pages.length));
  return Buffer.from(await pdf.save());
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
  const pdf = await buildQuotePdfBuffer(bundle, quote);

  let htmlStored = false;
  let pdfStored = false;
  let bucketError: string | null = null;
  let htmlError: string | null = null;
  let pdfError: string | null = null;

  const bucketResult = await ensurePrivateStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
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
      htmlStored = true;
    }

    const pdfUpload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(pdfPath, pdf, {
      contentType: "application/pdf",
      upsert: true
    });
    if (pdfUpload.error) {
      pdfError = pdfUpload.error.message;
    } else {
      pdfStored = true;
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
    storage_bucket: htmlStored ? JOB_DOCUMENTS_BUCKET : null,
    storage_path: htmlStored ? htmlPath : null,
    public_url: null,
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
    storage_bucket: pdfStored ? JOB_DOCUMENTS_BUCKET : null,
    storage_path: pdfStored ? pdfPath : null,
    public_url: null,
    source_type: "generated",
    mime_type: "application/pdf",
    file_size: pdf.length,
    content_html: null
  };

  const [htmlResult, pdfResult] = await Promise.all([
    existingHtml?.id
      ? supabase.from("job_documents").update(htmlPayload).eq("id", existingHtml.id).select("id").single()
      : supabase.from("job_documents").insert(htmlPayload).select("id").single(),
    existingPdf?.id
      ? supabase.from("job_documents").update(pdfPayload).eq("id", existingPdf.id).select("id").single()
      : supabase.from("job_documents").insert(pdfPayload).select("id").single()
  ]);

  const htmlUrl = htmlResult.data?.id && (htmlStored || Boolean(existingHtml?.id)) ? getDocumentFileHref(htmlResult.data.id) : null;
  const pdfUrl = pdfStored || Boolean(existingPdf?.id) ? getQuotePdfHref(quote.id) : null;

  if (pdfStored) {
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

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const safeText = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/[^\x20-\x7E£]/g, " ");
  const words = safeText.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current.length) {
      current = word;
      continue;
    }
    if (font.widthOfTextAtSize(`${current} ${word}`, size) > maxWidth) {
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

function customerFacingLabel(value: string) {
  const labels: Record<string, string> = {
    access: "Access and scaffolding",
    labour: "Labour",
    materials: "Materials",
    roof_works: "Roofing works"
  };
  const key = value.trim().toLowerCase();
  return labels[key] || value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function drawQuoteFooter(page: PDFPage, bold: PDFFont, regular: PDFFont, businessName: string, quoteRef: string, pageNumber: number, pageCount: number) {
  page.drawLine({ start: { x: 48, y: 39 }, end: { x: 547, y: 39 }, thickness: 0.6, color: rgb(0.86, 0.82, 0.69) });
  page.drawText(businessName.slice(0, 54), { x: 48, y: 23, font: bold, size: 7, color: rgb(0.38, 0.38, 0.36) });
  page.drawText(`${quoteRef}  |  Page ${pageNumber} of ${pageCount}`, { x: 447, y: 23, font: regular, size: 7, color: rgb(0.38, 0.38, 0.36) });
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
  const directNote = line.billed_separately ? line.billed_separately_note?.trim() || "Paid directly to the supplier — not included in this total." : null;
  return [line.quote_section ? line.item : null, directNote, line.notes].filter(Boolean).join(" - ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
