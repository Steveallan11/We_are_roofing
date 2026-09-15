import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getDocumentFileHref } from "@/lib/documents";
import { JOB_DOCUMENTS_BUCKET, ensurePrivateStorageBucket } from "@/lib/storage";
import type { InvoiceRecord, JobBundle, JobDocumentRecord } from "@/lib/types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

const GOLD = rgb(0.78, 0.58, 0.08);
const DARK = rgb(0.07, 0.09, 0.1);
const INK = rgb(0.1, 0.12, 0.14);
const MUTED = rgb(0.35, 0.39, 0.42);
const PALE = rgb(0.95, 0.95, 0.94);
const CREAM = rgb(0.97, 0.96, 0.92);
const WHITE = rgb(1, 1, 1);

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function buildJobCompletionPdf(bundle: JobBundle) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.276, 841.89]);
  const logo = await loadLogo(pdf);
  const invoice = latestInvoice(bundle.invoices);
  const worksTitle = getRoofingSystem(bundle);
  const works = getWorksSummary(bundle);

  if (logo) page.drawImage(logo, { x: 35, y: 712, width: 168, height: 105 });
  drawRight(page, "WE ARE ROOFING UK LTD", 558, 793, bold, 9, MUTED);
  drawRight(page, "JOB COMPLETION", 558, 761, bold, 27, INK);
  drawRight(page, "SHEET", 558, 728, bold, 27, GOLD);
  page.drawLine({ start: { x: 34, y: 700 }, end: { x: 558, y: 700 }, thickness: 1, color: INK });
  page.drawLine({ start: { x: 34, y: 700 }, end: { x: 188, y: 700 }, thickness: 2, color: GOLD });

  drawInfoGrid(page, bundle, invoice, regular, bold, 682);
  page.drawRectangle({ x: 34, y: 535, width: 524, height: 62, color: INK });
  page.drawRectangle({ x: 34, y: 535, width: 4, height: 62, color: GOLD });
  page.drawText("COMPLETED ROOFING SYSTEM", { x: 52, y: 575, font: bold, size: 8, color: GOLD });
  drawWrapped(page, worksTitle, 52, 554, 485, bold, 14, WHITE, 17, 2);

  sectionTitle(page, "WORKS COMPLETED", 34, 505, bold);
  const workLines = splitWorks(works);
  let y = 474;
  workLines.slice(0, 4).forEach((work, index) => {
    const lines = wrap(work, regular, 10.5, 460);
    const height = Math.max(47, lines.length * 14 + 18);
    page.drawRectangle({ x: 34, y: y - height, width: 524, height, color: WHITE, borderColor: rgb(0.78, 0.8, 0.81), borderWidth: 0.6 });
    page.drawRectangle({ x: 34, y: y - height, width: 34, height, color: rgb(0.88, 0.89, 0.89) });
    page.drawText(String(index + 1), { x: 48, y: y - 28, font: bold, size: 10, color: INK });
    drawLines(page, lines, 80, y - 22, regular, 10.5, INK, 14);
    y -= height + 12;
  });
  const record = `Works completed at ${bundle.job.property_address} for ${bundle.customer.full_name} as agreed for ${bundle.job.job_title}.${invoice ? ` This job completion sheet accompanies invoice ${invoice.invoice_ref}.` : ""}`;
  const recordLines = wrap(record, regular, 9.5, 420);
  page.drawRectangle({ x: 34, y: y - 56, width: 524, height: 56, color: PALE, borderColor: rgb(0.78, 0.8, 0.81), borderWidth: 0.6 });
  page.drawText("COMPLETION", { x: 48, y: y - 23, font: bold, size: 9, color: INK });
  page.drawText("RECORD", { x: 48, y: y - 36, font: bold, size: 9, color: INK });
  drawLines(page, recordLines, 152, y - 22, regular, 9.5, INK, 13);
  drawFooter(page, bundle, regular, bold);
  return Buffer.from(await pdf.save());
}

export async function buildWarrantyCertificatePdf(bundle: JobBundle, options?: { warrantyYears?: number; completionDate?: Date }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const page = pdf.addPage([595.276, 841.89]);
  const logo = await loadLogo(pdf);
  const invoice = latestInvoice(bundle.invoices);
  const years = normaliseWarrantyYears(options?.warrantyYears ?? getGuaranteeYears(bundle.quote?.guarantee_text));
  const completed = options?.completionDate ?? new Date();
  const dateText = completed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  page.drawRectangle({ x: 10, y: 10, width: 575, height: 822, borderColor: DARK, borderWidth: 2.4 });
  page.drawRectangle({ x: 14, y: 14, width: 567, height: 814, borderColor: GOLD, borderWidth: 1 });
  page.drawRectangle({ x: 16, y: 736, width: 205, height: 90, color: DARK });
  page.drawText("ROOFING TODAY", { x: 28, y: 801, font: bold, size: 6.5, color: rgb(0.96, 0.86, 0.55) });
  page.drawText("FOR A STRONGER", { x: 28, y: 789, font: bold, size: 6.5, color: rgb(0.96, 0.86, 0.55) });
  page.drawText("TOMORROW", { x: 28, y: 777, font: bold, size: 6.5, color: rgb(0.96, 0.86, 0.55) });
  if (logo) page.drawImage(logo, { x: 218, y: 739, width: 160, height: 90 });
  page.drawSvgPath("M 16 736 L 16 826 L 232 826 Z", { color: DARK });
  page.drawSvgPath("M 120 736 L 228 826 L 250 826 L 139 736 Z", { color: GOLD, opacity: 0.75 });
  page.drawSvgPath("M 144 736 L 245 826 L 256 826 L 155 736 Z", { color: rgb(0.96, 0.78, 0.32), opacity: 0.8 });
  drawRight(page, "WORKMANSHIP WARRANTY", 566, 808, bold, 7, MUTED);
  drawRight(page, "QUALITY ROOFS", 566, 795, regular, 7, MUTED);
  drawRight(page, "STRONGER HOMES", 566, 783, regular, 7, MUTED);
  drawRight(page, "BRIGHTER TOMORROWS", 566, 771, regular, 7, MUTED);
  drawCentre(page, "WARRANTY CERTIFICATE", 298, 698, serif, 25, INK);
  drawCentre(page, "HIGH-PERFORMANCE ROOFING SYSTEM", 298, 678, regular, 8.5, INK);
  page.drawLine({ start: { x: 150, y: 670 }, end: { x: 446, y: 670 }, thickness: 0.7, color: GOLD });

  page.drawRectangle({ x: 27, y: 566, width: 541, height: 102, color: DARK, borderColor: GOLD, borderWidth: 2 });
  drawCentre(page, `${years} YEARS`, 298, 594, serif, 61, rgb(0.93, 0.73, 0.24));
  drawCentre(page, "WE ARE ROOFING WORKMANSHIP WARRANTY", 298, 574, bold, 9.5, WHITE);
  drawInfoGrid(page, bundle, invoice, regular, bold, 554);

  sectionTitle(page, "OUR WORKMANSHIP GUARANTEE", 28, 465, serif);
  const guarantee = `Cover: ${years} years from the confirmed completion date for the installed ${getRoofingSystem(bundle).toLowerCase()}. The guarantee covers defects arising directly from our installation workmanship to the roof covering and associated waterproofing details.`;
  drawWrapped(page, guarantee, 28, 446, 258, regular, 9, INK, 13, 9);
  page.drawRectangle({ x: 28, y: 260, width: 255, height: 105, color: CREAM, borderColor: rgb(0.82, 0.77, 0.62), borderWidth: 0.6 });
  page.drawText("MANUFACTURER'S WARRANTY", { x: 42, y: 344, font: serif, size: 10, color: INK });
  drawWrapped(page, "Any separate manufacturer cover depends on the installed products and the manufacturer's own terms. Product-specific cover should be verified against the invoice and product documentation.", 42, 324, 225, regular, 8, INK, 11, 8);
  page.drawText("COMPLETION DATE", { x: 28, y: 239, font: bold, size: 7, color: GOLD });
  page.drawText(dateText, { x: 28, y: 225, font: regular, size: 8.5, color: INK });
  drawWarrantySeal(page, years, serif, bold);

  page.drawLine({ start: { x: 298, y: 475 }, end: { x: 298, y: 144 }, thickness: 0.5, color: rgb(0.82, 0.77, 0.62) });
  sectionTitle(page, "INSTALLED ROOFING SYSTEM", 312, 465, serif);
  const systemItems = [
    ["Works completed", bundle.job.job_title],
    ["Installed covering", getRoofingSystem(bundle)],
    ["Product specification", "Materials and individual products are recorded on the accepted quote and invoice."]
  ];
  let sy = 437;
  systemItems.forEach(([title, body], index) => {
    page.drawCircle({ x: 323, y: sy + 1, size: 10, color: DARK, borderColor: GOLD, borderWidth: 1 });
    page.drawText(String(index + 1), { x: 320, y: sy - 3, font: bold, size: 8, color: WHITE });
    page.drawText(title, { x: 342, y: sy + 3, font: bold, size: 8, color: INK });
    drawWrapped(page, body, 342, sy - 9, 215, regular, 7.5, INK, 10, 3);
    sy -= 49;
  });
  sectionTitle(page, "GUARANTEE CONDITIONS", 312, 287, serif);
  const conditions = [
    "Applies to defects caused by our original installation workmanship.",
    "Excludes third-party damage, alterations, penetrations, misuse, fire, extreme weather and unrelated structural failure.",
    "Later work affecting the roof covering must be agreed with We Are Roofing.",
    "Keep roofs, outlets and gutters reasonably clear and report suspected defects promptly.",
    "Valid workmanship defects will be repaired within the affected area."
  ];
  let cy = 263;
  conditions.forEach((condition, index) => {
    page.drawRectangle({ x: 312, y: cy - 4, width: 16, height: 16, color: rgb(0.9, 0.69, 0.2) });
    page.drawText(String(index + 1), { x: 317, y: cy, font: bold, size: 7, color: DARK });
    const lines = wrap(condition, regular, 6.8, 218);
    drawLines(page, lines, 336, cy + 4, regular, 6.8, INK, 8.5);
    cy -= Math.max(25, lines.length * 8.5 + 7);
  });
  page.drawText("FOR AND ON BEHALF OF", { x: 248, y: 116, font: regular, size: 6, color: MUTED });
  page.drawText("WE ARE ROOFING UK LTD", { x: 248, y: 104, font: bold, size: 7, color: INK });
  page.drawLine({ start: { x: 215, y: 72 }, end: { x: 393, y: 72 }, thickness: 0.7, color: GOLD });
  page.drawSvgPath("M 224 77 C 245 105 260 70 278 94 C 294 116 312 70 329 91 C 345 109 360 78 378 89", { borderColor: INK, borderWidth: 1.2 });
  drawCentre(page, "AUTHORISED SIGNATORY", 304, 59, bold, 8, INK);
  page.drawRectangle({ x: 12, y: 12, width: 571, height: 35, color: DARK });
  drawCentre(page, "ROOFING TODAY FOR A STRONGER TOMORROW", 298, 27, regular, 6.5, rgb(0.96, 0.86, 0.55));
  return Buffer.from(await pdf.save());
}

export async function persistHandoverDocuments(supabase: AdminClient, bundle: JobBundle, options?: { warrantyYears?: number }) {
  const createdAt = new Date();
  const [completion, warranty] = await Promise.all([buildJobCompletionPdf(bundle), buildWarrantyCertificatePdf(bundle, { warrantyYears: options?.warrantyYears, completionDate: createdAt })]);
  const bucket = await ensurePrivateStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
  if (!bucket.ok) throw new Error(bucket.error);
  const timestamp = Date.now();
  const definitions = [
    { type: "job_completion_pdf", name: "Job Completion Sheet.pdf", path: `${bundle.job.id}/handover/job-completion-${timestamp}.pdf`, content: completion },
    { type: "workmanship_warranty_pdf", name: "Workmanship Warranty Certificate.pdf", path: `${bundle.job.id}/handover/workmanship-warranty-${timestamp}.pdf`, content: warranty }
  ];
  const documents: JobDocumentRecord[] = [];
  for (const definition of definitions) {
    const upload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(definition.path, definition.content, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw new Error(upload.error.message);
    const existing = await supabase.from("job_documents").select("id").eq("job_id", bundle.job.id).eq("document_type", definition.type).limit(1).maybeSingle();
    const payload = { job_id: bundle.job.id, quote_id: bundle.quote?.id ?? null, invoice_id: latestInvoice(bundle.invoices)?.id ?? null, document_type: definition.type, display_name: definition.name, storage_bucket: JOB_DOCUMENTS_BUCKET, storage_path: definition.path, public_url: null, source_type: "generated", mime_type: "application/pdf", file_size: definition.content.length, content_html: null };
    const result = existing.data?.id
      ? await supabase.from("job_documents").update(payload).eq("id", existing.data.id).select("*").single()
      : await supabase.from("job_documents").insert(payload).select("*").single();
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Could not file generated document.");
    documents.push(result.data as JobDocumentRecord);
  }
  return documents.map((document) => ({ ...document, href: getDocumentFileHref(document.id) }));
}

function latestInvoice(invoices: InvoiceRecord[]) {
  return invoices.find((invoice) => invoice.status !== "Void") ?? invoices[0] ?? null;
}
function getGuaranteeYears(value?: string | null) {
  const years = Number(value?.match(/\b(\d{1,2})\s*[- ]?years?\b/i)?.[1] ?? 15);
  return years > 0 && years <= 50 ? years : 15;
}
function normaliseWarrantyYears(value: number) { return [5, 10, 15, 20, 25].includes(value) ? value : 15; }
function drawWarrantySeal(page: PDFPage, years: number, serif: PDFFont, bold: PDFFont) {
  const x = 106; const y = 116;
  page.drawCircle({ x, y, size: 47, color: DARK, borderColor: GOLD, borderWidth: 4 });
  page.drawCircle({ x, y, size: 37, borderColor: rgb(0.95, 0.77, 0.3), borderWidth: 1.2 });
  drawCentre(page, String(years), x, y + 2, serif, 27, rgb(0.95, 0.75, 0.25));
  drawCentre(page, "YEARS", x, y - 15, bold, 7, WHITE);
  drawCentre(page, "WORKMANSHIP", x, y + 31, bold, 5.5, rgb(0.95, 0.75, 0.25));
  page.drawSvgPath(`M ${x - 38} ${y - 35} L ${x - 25} ${y - 61} L ${x} ${y - 45} L ${x + 25} ${y - 61} L ${x + 38} ${y - 35} Z`, { color: GOLD });
}
function getRoofingSystem(bundle: JobBundle) {
  return bundle.survey?.recommended_works?.split(/[.\n]/)[0]?.trim() || bundle.job.roof_type || bundle.job.job_title || "Completed roofing system";
}
function getWorksSummary(bundle: JobBundle) {
  return bundle.quote?.scope_of_works || bundle.survey?.recommended_works || bundle.job.internal_notes || bundle.job.job_title;
}
function splitWorks(value: string) {
  const lines = value.split(/\n+/).map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim()).filter(Boolean);
  return lines.length > 1 ? lines : value.split(/(?<=[.!?])\s+/).filter(Boolean);
}
async function loadLogo(pdf: PDFDocument) {
  try { return await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "we-are-roofing-logo.png"))); } catch { return null; }
}
function drawInfoGrid(page: PDFPage, bundle: JobBundle, invoice: InvoiceRecord | null, regular: PDFFont, bold: PDFFont, top: number) {
  const x = 34; const width = 524; const height = 64; const cell = width / 4;
  page.drawRectangle({ x, y: top - height, width, height, color: PALE, borderColor: rgb(0.78, 0.8, 0.81), borderWidth: 0.5 });
  const values = [["CUSTOMER", bundle.customer.full_name], ["SITE ADDRESS", `${bundle.job.property_address}\n${bundle.job.postcode}`], ["JOB REF", bundle.job.job_ref || bundle.job.id], ["QUOTE / INVOICE", `${bundle.quote?.quote_ref || "-"}\n${invoice?.invoice_ref || "-"}`]];
  values.forEach(([label, value], index) => {
    if (index) page.drawLine({ start: { x: x + cell * index, y: top - height }, end: { x: x + cell * index, y: top }, thickness: 0.5, color: rgb(0.78, 0.8, 0.81) });
    page.drawText(label, { x: x + cell * index + 12, y: top - 19, font: bold, size: 6.5, color: MUTED });
    const valueLines = value.split("\n").flatMap((line) => wrap(line, regular, 8.5, cell - 24)).slice(0, 3);
    drawLines(page, valueLines, x + cell * index + 12, top - 38, regular, 8.5, INK, 11);
  });
}
function sectionTitle(page: PDFPage, value: string, x: number, y: number, font: PDFFont) { page.drawRectangle({ x, y: y - 4, width: 3, height: 17, color: GOLD }); page.drawText(value, { x: x + 12, y, font, size: 12, color: INK }); }
function drawFooter(page: PDFPage, bundle: JobBundle, regular: PDFFont, bold: PDFFont) { page.drawRectangle({ x: 0, y: 0, width: 595.276, height: 52, color: INK }); const items = [bundle.business.phone, bundle.business.email, "weareroofing.co.uk", bundle.business.trading_address].filter(Boolean); items.forEach((item, index) => page.drawText(String(item).slice(0, 34), { x: 34 + index * 132, y: 28, font: regular, size: 6.5, color: WHITE })); drawCentre(page, "WE ARE ROOFING UK LTD", 298, 11, bold, 7, WHITE); }
function drawCentre(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) { const safe = pdfSafe(value); page.drawText(safe, { x: x - font.widthOfTextAtSize(safe, size) / 2, y, font, size, color }); }
function drawRight(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) { const safe = pdfSafe(value); page.drawText(safe, { x: x - font.widthOfTextAtSize(safe, size), y, font, size, color }); }
function drawWrapped(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>, lineHeight: number, maxLines: number) { drawLines(page, wrap(value, font, size, width).slice(0, maxLines), x, y, font, size, color, lineHeight); }
function drawLines(page: PDFPage, lines: string[], x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>, lineHeight: number) { lines.forEach((line, index) => page.drawText(pdfSafe(line), { x, y: y - index * lineHeight, font, size, color })); }
function wrap(value: string, font: PDFFont, size: number, width: number) { const words = pdfSafe(value).replace(/\s+/g, " ").trim().split(" "); const lines: string[] = []; let current = ""; for (const word of words) { const next = current ? `${current} ${word}` : word; if (current && font.widthOfTextAtSize(next, size) > width) { lines.push(current); current = word; } else current = next; } if (current) lines.push(current); return lines; }
function pdfSafe(value: string) { return String(value || "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[•·]/g, "-").replace(/[^\x20-\x7E£\n]/g, " "); }
