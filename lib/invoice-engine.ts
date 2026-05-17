import { getStoragePublicUrl, JOB_DOCUMENTS_BUCKET, ensurePublicStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvoiceLineItem, InvoiceRecord, JobBundle, QuoteRecord } from "@/lib/types";

export function buildInvoiceLineItemsFromQuote(quote: QuoteRecord): InvoiceLineItem[] {
  return quote.cost_breakdown.map((line) => ({
    description: line.item,
    quantity: 1,
    unit: "item",
    unit_price: line.cost,
    vat_applicable: line.vat_applicable,
    total: line.cost
  }));
}

export function buildInvoiceDocumentHtml(bundle: JobBundle, invoice: InvoiceRecord) {
  const logoUrl = resolveAssetUrl(bundle.business.logo_url || "/we-are-roofing-logo.png");
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
  const lines = [
    bundle.business.business_name,
    bundle.business.trading_address || "",
    "",
    `Invoice Ref: ${invoice.invoice_ref}`,
    `Customer: ${bundle.customer.full_name}`,
    `Property: ${bundle.job.property_address}`,
    `Issue Date: ${formatDate(invoice.issue_date)}`,
    `Due Date: ${formatDate(invoice.due_date)}`,
    "",
    "Items"
  ];

  for (const item of invoice.line_items) {
    lines.push(`${item.description} (${item.quantity} ${item.unit}) - ${formatCurrency(item.total)}`);
  }

  lines.push(
    "",
    `Subtotal: ${formatCurrency(invoice.subtotal)}`,
    `VAT: ${formatCurrency(invoice.vat_amount)}`,
    `Total: ${formatCurrency(invoice.total)}`,
    `Paid: ${formatCurrency(invoice.amount_paid)}`,
    `Balance Due: ${formatCurrency(invoice.balance_due)}`,
    "",
    "Payment Terms",
    ...wrapText(invoice.payment_terms || bundle.business.payment_terms || "Payment due on receipt.")
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
  let htmlUrl: string | null = null;
  let pdfUrl: string | null = null;
  let error: string | null = null;

  const bucketResult = await ensurePublicStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
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
    if (!htmlUpload.error) htmlUrl = getStoragePublicUrl(supabase, JOB_DOCUMENTS_BUCKET, htmlPath);
    if (!pdfUpload.error) pdfUrl = getStoragePublicUrl(supabase, JOB_DOCUMENTS_BUCKET, pdfPath);
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
    invoice_id: invoice.id,
    document_type: "invoice_pdf",
    display_name: `${invoice.invoice_ref}.pdf`,
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
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
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
