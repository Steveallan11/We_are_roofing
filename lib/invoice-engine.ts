import { getDocumentFileHref, getInvoicePdfHref } from "@/lib/documents";
import { JOB_DOCUMENTS_BUCKET, ensurePrivateStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFirmQuoteLines } from "@/lib/quotes/provisional";
import type { InvoiceLineItem, InvoiceRecord, JobBundle, QuoteRecord } from "@/lib/types";

/**
 * Split a VAT-inclusive amount into net + VAT using the quote's own effective
 * VAT ratio, so partial invoices (deposit/interim/final/stage) stay
 * consistent with the quote whatever the business VAT setup is.
 */
export function splitVatFromGross(gross: number, quoteSubtotal?: number | null, quoteVat?: number | null) {
  const net = Number(quoteSubtotal ?? 0);
  const vat = Number(quoteVat ?? 0);
  const ratio = net > 0 && vat > 0 ? vat / net : 0;
  const subtotal = ratio > 0 ? round2(gross / (1 + ratio)) : gross;
  return { subtotal, vatAmount: round2(gross - subtotal) };
}

/** Total already invoiced (excluding voided invoices) for a quote. */
export function sumLiveInvoiceTotal(invoices: InvoiceRecord[]) {
  return round2(invoices.filter((invoice) => invoice.status !== "Void").reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0));
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildInvoiceLineItemsFromQuote(quote: QuoteRecord): InvoiceLineItem[] {
  return getFirmQuoteLines(quote.cost_breakdown)
    .filter((line) => Number(line.cost ?? 0) > 0 && !line.billed_separately)
    .map((line) => ({
    description: line.item,
    quantity: 1,
    unit: "item",
    unit_price: line.cost,
    vat_applicable: line.vat_applicable,
    total: line.cost
    }));
}

export function calculateQuoteInvoiceableTotals(quote: QuoteRecord, vatRate: number) {
  const firmLines = getFirmQuoteLines(quote.cost_breakdown).filter((line) => !line.billed_separately);
  const subtotal = round2(firmLines.reduce((sum, line) => sum + Number(line.cost ?? 0), 0));
  const vatAmount = round2(
    firmLines.filter((line) => line.vat_applicable).reduce((sum, line) => sum + Number(line.cost ?? 0) * (vatRate / 100), 0)
  );
  const total = round2(subtotal + vatAmount);
  const excludedCount = (quote.cost_breakdown?.length ?? 0) - firmLines.length;
  return { firmLines, subtotal, vatAmount, total, excludedCount };
}

export function buildInvoiceDocumentHtml(bundle: JobBundle, invoice: InvoiceRecord) {
  const logoUrl = resolveAssetUrl(bundle.business.logo_url || "/we-are-roofing-logo.png");
  const isDeposit = invoice.invoice_type === "deposit";
  const introHtml = isDeposit
    ? `
        <h2>Booking Deposit</h2>
        <div class="terms">
          Thank you for choosing We Are Roofing UK Ltd. This deposit secures your booking in our schedule for ${escapeHtml(bundle.job.job_title)} at ${escapeHtml(bundle.job.property_address)}.
          <br/><br/>
          It allows us to begin arranging the items needed before work commences, including materials, scaffold/access, skips, welfare facilities, and other job preparation where required. Getting these in place early helps minimise delays once the works start.
        </div>`
    : `
        <h2>Works Completed</h2>
        <div class="terms">Works completed at ${escapeHtml(bundle.job.property_address)} as agreed for ${escapeHtml(bundle.job.job_title)}.</div>`;
  const rows = invoice.line_items
    .map(
      (line) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;">${escapeHtml(line.description)}</td>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;text-align:center;">${line.quantity} ${escapeHtml(line.unit)}</td>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;text-align:right;">${formatCurrency(line.unit_price)}</td>
          <td style="padding:12px;border-bottom:1px solid #d8c58a;color:#101010;text-align:right;">${formatCurrency(line.total)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoice.invoice_ref)}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; background:#f3f0e4; color:#101010; padding:40px; }
      .sheet { max-width: 820px; margin: 0 auto; background:#ffffff; border:1px solid #d8c58a; border-radius:18px; overflow:hidden; }
      .hero { background:#101417; color:#f5e7b2; padding:28px 32px; display:flex; justify-content:space-between; gap:24px; }
      .hero img { max-width:170px; display:block; margin-bottom:18px; }
      .hero h1 { margin:0; font-size:42px; line-height:1; letter-spacing:0.04em; }
      .hero p { margin:8px 0 0; color:#d7c483; }
      .body { padding:28px 32px; }
      h2 { font-size:16px; margin:24px 0 10px; color:#101417; text-transform:uppercase; letter-spacing:0.1em; }
      table { width:100%; border-collapse:collapse; margin-top:18px; }
      th { text-align:left; padding:12px; border-bottom:2px solid #101417; text-transform:uppercase; font-size:12px; letter-spacing:0.08em; }
      .meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .meta-card { background:#f7f3e3; padding:12px 14px; border-radius:14px; }
      .meta-label { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#75663b; margin-bottom:6px; }
      .totals { margin-top:22px; margin-left:auto; width:min(330px,100%); }
      .totals div { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e5ddbf; }
      .totals div:last-child { border-bottom:none; font-size:20px; font-weight:700; color:#8d6a00; }
      .terms { background:#f7f3e3; border-radius:14px; padding:14px; line-height:1.6; white-space:pre-line; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="hero">
        <div>
          <img src="${logoUrl}" alt="We Are Roofing UK Ltd" />
          <p>${escapeHtml(bundle.business.trading_address || "")}</p>
          <p>${escapeHtml(bundle.business.email)} · ${escapeHtml(bundle.business.phone)}</p>
        </div>
        <div style="text-align:right;">
          <h1>Invoice</h1>
          <p>${escapeHtml(invoice.invoice_ref)}</p>
        </div>
      </div>
      <div class="body">
        <div class="meta">
          <div class="meta-card"><div class="meta-label">Customer</div><div>${escapeHtml(bundle.customer.full_name)}</div></div>
          <div class="meta-card"><div class="meta-label">Job Ref</div><div>${escapeHtml(bundle.job.job_ref || bundle.job.id)}</div></div>
          <div class="meta-card"><div class="meta-label">Property</div><div>${escapeHtml(bundle.job.property_address)}</div></div>
          <div class="meta-card"><div class="meta-label">Due Date</div><div>${formatDate(invoice.due_date)}</div></div>
        </div>
        ${introHtml}
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Rate</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div><span>Subtotal</span><span>${formatCurrency(invoice.subtotal)}</span></div>
          <div><span>VAT</span><span>${formatCurrency(invoice.vat_amount)}</span></div>
          <div><span>Total</span><span>${formatCurrency(invoice.total)}</span></div>
          <div><span>Paid</span><span>${formatCurrency(invoice.amount_paid)}</span></div>
          <div><span>Balance Due</span><span>${formatCurrency(invoice.balance_due)}</span></div>
        </div>
        <h2>Payment Terms</h2>
        <div class="terms">${escapeHtml(invoice.payment_terms || bundle.business.payment_terms || "Payment due on receipt.")}</div>
        ${invoice.notes ? `<h2>Notes</h2><div class="terms">${escapeHtml(invoice.notes)}</div>` : ""}
      </div>
    </div>
  </body>
</html>`;
}

export function buildInvoicePdfBuffer(bundle: JobBundle, invoice: InvoiceRecord) {
  const isDeposit = invoice.invoice_type === "deposit";
  const pdf = new SimplePdf();
  let page = pdf.addPage();
  drawInvoiceHeader(page, bundle, invoice);
  let y = 686;

  y = drawInvoiceMeta(page, bundle, invoice, y);
  y -= 18;

  const introTitle = isDeposit ? "Booking Deposit" : "Works Completed";
  const introBody = isDeposit
    ? `Thank you for choosing We Are Roofing UK Ltd. This deposit secures your booking in our schedule for ${bundle.job.job_title} at ${bundle.job.property_address}. It allows us to begin arranging the items needed before work commences, including materials, scaffold/access, skips, welfare facilities, and other job preparation where required. Getting these in place early helps minimise delays once the works start.`
    : `Works completed at ${bundle.job.property_address} as agreed for ${bundle.job.job_title}.`;
  y = drawSectionBlock(page, introTitle, introBody, 46, y, 503);

  ({ page, y } = ensureInvoiceSpace(pdf, page, y, 150));
  y = drawInvoiceItems(page, invoice, y);

  ({ page, y } = ensureInvoiceSpace(pdf, page, y, 210));
  y = drawInvoiceTotals(page, invoice, y);

  ({ page, y } = ensureInvoiceSpace(pdf, page, y, 150));
  y = drawPaymentDetails(page, bundle, invoice, y);

  const terms = invoice.payment_terms || bundle.business.payment_terms || "Payment due on receipt.";
  ({ page, y } = ensureInvoiceSpace(pdf, page, y, 105));
  y = drawSectionBlock(page, "Payment Terms", terms, 46, y, 503);

  if (invoice.notes) {
    ({ page, y } = ensureInvoiceSpace(pdf, page, y, 95));
    drawSectionBlock(page, "Notes", invoice.notes, 46, y, 503);
  }

  pdf.pages.forEach((item, index) => drawInvoiceFooter(item, index + 1, pdf.pages.length));
  return pdf.toBuffer();
}

type PdfPage = {
  commands: string[];
};

type PdfColour = [number, number, number];

const PDF = {
  width: 595,
  height: 842,
  black: [10, 10, 10] as PdfColour,
  ink: [20, 24, 28] as PdfColour,
  gold: [212, 175, 55] as PdfColour,
  warm: [250, 248, 240] as PdfColour,
  cream: [246, 241, 226] as PdfColour,
  border: [222, 211, 176] as PdfColour,
  muted: [92, 99, 112] as PdfColour,
  white: [255, 255, 255] as PdfColour
};

class SimplePdf {
  pages: PdfPage[] = [];

  addPage() {
    const page: PdfPage = { commands: [] };
    rect(page, 0, 0, PDF.width, PDF.height, PDF.warm);
    rect(page, 34, 34, PDF.width - 68, PDF.height - 68, PDF.white);
    strokeRect(page, 34, 34, PDF.width - 68, PDF.height - 68, PDF.border, 1);
    this.pages.push(page);
    return page;
  }

  toBuffer() {
    const fontRegularId = 3 + this.pages.length * 2;
    const fontBoldId = fontRegularId + 1;
    const pageObjectIds = this.pages.map((_, index) => 3 + index * 2);
    const contentObjectIds = this.pages.map((_, index) => 4 + index * 2);
    const objects: string[] = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      `2 0 obj << /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >> endobj`
    ];

    this.pages.forEach((page, index) => {
      const stream = page.commands.join("\n");
      objects.push(
        `${pageObjectIds[index]} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF.width} ${PDF.height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >> endobj`,
        `${contentObjectIds[index]} 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`
      );
    });

    objects.push(
      `${fontRegularId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
      `${fontBoldId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj`
    );

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
}

function drawInvoiceHeader(page: PdfPage, bundle: JobBundle, invoice: InvoiceRecord) {
  rect(page, 34, 704, 527, 104, PDF.black);
  rect(page, 34, 704, 527, 4, PDF.gold);
  text(page, "WE ARE ROOFING UK LTD", 54, 777, { size: 14, font: "bold", colour: PDF.gold, tracking: 1.2 });
  text(page, bundle.business.trading_address || "Yateley, Hampshire", 54, 757, { size: 9, colour: [205, 198, 181] });
  text(page, [bundle.business.phone, bundle.business.email].filter(Boolean).join("  |  "), 54, 742, { size: 9, colour: [205, 198, 181] });
  text(page, "INVOICE", 535, 770, { size: 30, font: "bold", colour: PDF.white, align: "right" });
  text(page, invoice.invoice_ref, 535, 744, { size: 11, font: "bold", colour: PDF.gold, align: "right" });
  text(page, `Issued ${formatDate(invoice.issue_date)}`, 535, 728, { size: 9, colour: [205, 198, 181], align: "right" });
}

function drawInvoiceMeta(page: PdfPage, bundle: JobBundle, invoice: InvoiceRecord, y: number) {
  const cardW = 244;
  const cardH = 52;
  drawMetaCard(page, 46, y, cardW, cardH, "Customer", bundle.customer.full_name);
  drawMetaCard(page, 305, y, cardW, cardH, "Due Date", formatDate(invoice.due_date));
  drawMetaCard(page, 46, y - 64, cardW, cardH, "Property", bundle.job.property_address);
  drawMetaCard(page, 305, y - 64, cardW, cardH, "Job", bundle.job.job_ref || bundle.job.job_title);
  return y - 132;
}

function drawMetaCard(page: PdfPage, x: number, y: number, w: number, h: number, label: string, value: string) {
  rect(page, x, y - h, w, h, PDF.cream);
  strokeRect(page, x, y - h, w, h, PDF.border, 0.8);
  text(page, label.toUpperCase(), x + 12, y - 18, { size: 7.5, font: "bold", colour: [130, 104, 24], tracking: 1 });
  textWrapped(page, value || "-", x + 12, y - 34, w - 24, { size: 10, font: "bold", colour: PDF.ink, lineHeight: 12, maxLines: 2 });
}

function drawSectionBlock(page: PdfPage, title: string, body: string, x: number, y: number, width: number) {
  text(page, title.toUpperCase(), x, y, { size: 9, font: "bold", colour: PDF.gold, tracking: 1.4 });
  line(page, x + 120, y + 3, x + width, y + 3, PDF.border, 0.8);
  const bodyY = y - 20;
  const lines = wrapTextForWidth(body, width - 24, 10.5);
  const height = Math.max(54, lines.length * 14 + 24);
  rect(page, x, bodyY - height + 14, width, height, PDF.cream);
  strokeRect(page, x, bodyY - height + 14, width, height, PDF.border, 0.8);
  textLines(page, lines, x + 12, bodyY, { size: 10.5, colour: PDF.ink, lineHeight: 14 });
  return bodyY - height - 8;
}

function drawInvoiceItems(page: PdfPage, invoice: InvoiceRecord, y: number) {
  text(page, "INVOICE ITEMS", 46, y, { size: 9, font: "bold", colour: PDF.gold, tracking: 1.4 });
  line(page, 150, y + 3, 549, y + 3, PDF.border, 0.8);
  y -= 24;
  rect(page, 46, y - 28, 503, 28, PDF.black);
  text(page, "DESCRIPTION", 58, y - 18, { size: 8, font: "bold", colour: PDF.gold, tracking: 1 });
  text(page, "QTY", 376, y - 18, { size: 8, font: "bold", colour: PDF.gold, align: "right", tracking: 1 });
  text(page, "AMOUNT", 535, y - 18, { size: 8, font: "bold", colour: PDF.gold, align: "right", tracking: 1 });
  y -= 42;

  for (const item of invoice.line_items) {
    const descriptionLines = wrapTextForWidth(item.description, 250, 10.5);
    const rowHeight = Math.max(34, descriptionLines.length * 13 + 14);
    textLines(page, descriptionLines, 58, y, { size: 10.5, font: "bold", colour: PDF.ink, lineHeight: 13 });
    text(page, `${item.quantity} ${item.unit}`, 376, y, { size: 10, colour: PDF.muted, align: "right" });
    text(page, formatCurrency(item.total), 535, y, { size: 11, font: "bold", colour: PDF.ink, align: "right" });
    line(page, 46, y - rowHeight + 8, 549, y - rowHeight + 8, [232, 226, 206], 0.6);
    y -= rowHeight;
  }

  return y - 8;
}

function drawInvoiceTotals(page: PdfPage, invoice: InvoiceRecord, y: number) {
  const x = 295;
  const w = 254;
  rect(page, x, y - 118, w, 118, PDF.cream);
  strokeRect(page, x, y - 118, w, 118, PDF.border, 0.8);
  y -= 20;
  y = drawTotalRow(page, x + 14, y, w - 28, "Subtotal", formatCurrency(invoice.subtotal));
  y = drawTotalRow(page, x + 14, y, w - 28, "VAT", formatCurrency(invoice.vat_amount));
  y = drawTotalRow(page, x + 14, y, w - 28, "Total", formatCurrency(invoice.total), true);
  y = drawTotalRow(page, x + 14, y, w - 28, "Paid", formatCurrency(invoice.amount_paid));
  drawTotalRow(page, x + 14, y, w - 28, "Balance Due", formatCurrency(invoice.balance_due), true);
  return y - 42;
}

function drawTotalRow(page: PdfPage, x: number, y: number, width: number, label: string, value: string, emphasis = false) {
  text(page, label, x, y, { size: emphasis ? 11 : 9.5, font: emphasis ? "bold" : "regular", colour: emphasis ? PDF.gold : PDF.ink });
  text(page, value, x + width, y, { size: emphasis ? 13 : 10, font: "bold", colour: emphasis ? PDF.gold : PDF.ink, align: "right" });
  return y - 20;
}

function drawPaymentDetails(page: PdfPage, bundle: JobBundle, invoice: InvoiceRecord, y: number) {
  text(page, "PAYMENT DETAILS", 46, y, { size: 9, font: "bold", colour: PDF.gold, tracking: 1.4 });
  line(page, 164, y + 3, 549, y + 3, PDF.border, 0.8);
  y -= 20;
  rect(page, 46, y - 88, 503, 88, PDF.black);
  rect(page, 46, y - 88, 5, 88, PDF.gold);
  const rows = [
    `Bank: ${bundle.business.bank_name || "Please contact Andy for bank details"}`,
    `Sort code: ${bundle.business.bank_sort_code || "Available on request"}`,
    `Account number: ${bundle.business.bank_account || "Available on request"}`,
    `Account name: ${bundle.business.bank_account_name || "We Are Roofing UK Ltd"}`,
    `Payment reference: ${invoice.invoice_ref}`
  ];
  textLines(page, rows, 64, y - 16, { size: 9.5, colour: [238, 232, 211], lineHeight: 13 });
  return y - 106;
}

function drawInvoiceFooter(page: PdfPage, pageNumber: number, totalPages: number) {
  rect(page, 34, 34, 527, 34, PDF.black);
  text(page, "We Are Roofing UK Ltd", 54, 48, { size: 8.5, font: "bold", colour: PDF.gold });
  text(page, `Page ${pageNumber} of ${totalPages}`, 541, 48, { size: 8.5, colour: [205, 198, 181], align: "right" });
}

function ensureInvoiceSpace(pdf: SimplePdf, page: PdfPage, y: number, needed: number) {
  if (y - needed > 92) return { page, y };
  const nextPage = pdf.addPage();
  text(nextPage, "WE ARE ROOFING UK LTD", 46, 782, { size: 11, font: "bold", colour: PDF.gold, tracking: 1.2 });
  text(nextPage, "Invoice continued", 549, 782, { size: 10, colour: PDF.muted, align: "right" });
  line(nextPage, 46, 764, 549, 764, PDF.border, 0.8);
  return { page: nextPage, y: 738 };
}

function rect(page: PdfPage, x: number, y: number, width: number, height: number, colour: PdfColour) {
  page.commands.push(`q ${rgb(colour)} rg ${x} ${y} ${width} ${height} re f Q`);
}

function strokeRect(page: PdfPage, x: number, y: number, width: number, height: number, colour: PdfColour, lineWidth: number) {
  page.commands.push(`q ${rgb(colour)} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S Q`);
}

function line(page: PdfPage, x1: number, y1: number, x2: number, y2: number, colour: PdfColour, lineWidth: number) {
  page.commands.push(`q ${rgb(colour)} RG ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
}

function text(
  page: PdfPage,
  value: string,
  x: number,
  y: number,
  opts: { size: number; font?: "regular" | "bold"; colour?: PdfColour; align?: "left" | "right"; tracking?: number }
) {
  const size = opts.size;
  const drawX = opts.align === "right" ? x - approximateTextWidth(value, size, opts.tracking ?? 0) : x;
  page.commands.push(
    `q ${rgb(opts.colour ?? PDF.ink)} rg BT /${opts.font === "bold" ? "F2" : "F1"} ${size} Tf ${drawX} ${y} Td (${escapePdf(value)}) Tj ET Q`
  );
}

function textLines(
  page: PdfPage,
  lines: string[],
  x: number,
  y: number,
  opts: { size: number; font?: "regular" | "bold"; colour?: PdfColour; lineHeight: number }
) {
  lines.forEach((item, index) => text(page, item, x, y - index * opts.lineHeight, opts));
}

function textWrapped(
  page: PdfPage,
  value: string,
  x: number,
  y: number,
  width: number,
  opts: { size: number; font?: "regular" | "bold"; colour?: PdfColour; lineHeight: number; maxLines?: number }
) {
  const lines = wrapTextForWidth(value, width, opts.size).slice(0, opts.maxLines ?? 99);
  textLines(page, lines, x, y, opts);
}

function wrapTextForWidth(value: string, width: number, fontSize: number) {
  const maxLength = Math.max(8, Math.floor(width / (fontSize * 0.52)));
  return wrapText(value, maxLength);
}

function approximateTextWidth(value: string, size: number, tracking = 0) {
  return value.length * size * 0.52 + Math.max(0, value.length - 1) * tracking;
}

function rgb(colour: PdfColour) {
  return colour.map((item) => (item / 255).toFixed(3)).join(" ");
}

export async function persistInvoiceArtifacts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bundle: JobBundle,
  invoice: InvoiceRecord
) {
  const timestamp = Date.now();
  const basePath = `${bundle.job.id}/invoices/${invoice.id}`;
  const htmlPath = `${basePath}/${invoice.invoice_ref.toLowerCase()}-${timestamp}.html`;
  const pdfPath = `${basePath}/${invoice.invoice_ref.toLowerCase()}-${timestamp}.pdf`;
  const html = buildInvoiceDocumentHtml(bundle, invoice);
  const pdf = buildInvoicePdfBuffer(bundle, invoice);
  let htmlStored = false;
  let pdfStored = false;
  let error: string | null = null;

  const bucketResult = await ensurePrivateStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
  if (!bucketResult.ok) {
    error = bucketResult.error;
  } else {
    const htmlUpload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(htmlPath, Buffer.from(html, "utf8"), {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });
    const pdfUpload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(pdfPath, pdf, {
      contentType: "application/pdf",
      upsert: true
    });

    error = htmlUpload.error?.message ?? pdfUpload.error?.message ?? null;
    if (!htmlUpload.error) htmlStored = true;
    if (!pdfUpload.error) pdfStored = true;
  }

  const [{ data: existingHtml }, { data: existingPdf }] = await Promise.all([
    supabase.from("job_documents").select("id").eq("invoice_id", invoice.id).eq("document_type", "invoice_html").limit(1).maybeSingle(),
    supabase.from("job_documents").select("id").eq("invoice_id", invoice.id).eq("document_type", "invoice_pdf").limit(1).maybeSingle()
  ]);

  const htmlPayload = {
    job_id: bundle.job.id,
    invoice_id: invoice.id,
    document_type: "invoice_html",
    display_name: `${invoice.invoice_ref} HTML Snapshot`,
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
    invoice_id: invoice.id,
    document_type: "invoice_pdf",
    display_name: `${invoice.invoice_ref}.pdf`,
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
  const pdfUrl = pdfStored || Boolean(existingPdf?.id) ? getInvoicePdfHref(invoice.id) : null;

  if (pdfStored) {
    await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoice.id);
  }

  return { htmlUrl, pdfUrl, html, pdf, error };
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
  if (current) lines.push(current);
  return lines;
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
  return Array.from(value)
    .map((char) => {
      if (char === "\\") return "\\\\";
      if (char === "(") return "\\(";
      if (char === ")") return "\\)";
      if (char === "£") return "\\243";
      if (char === "‘" || char === "’") return "'";
      if (char === "“" || char === "”") return '"';
      if (char === "–" || char === "—" || char === "•" || char === "·") return "-";
      return char.charCodeAt(0) > 255 ? "-" : char;
    })
    .join("");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function resolveAssetUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}
