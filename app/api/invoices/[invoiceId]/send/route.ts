import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getJobBundle } from "@/lib/data";
import { getInvoicePdfHref } from "@/lib/documents";
import { invoiceSentEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sendEmail";
import { persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { appendInvoiceFileToken } from "@/lib/invoices/publicLink";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ invoiceId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { invoiceId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    to_email?: string;
    email_customer_name?: string;
    due_date?: string;
    test?: boolean;
    attachment_document_ids?: string[];
  };
  const isTestSend = body.test === true;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Invoice send preview completed.", invoiceId });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: invoiceRecord, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (error || !invoiceRecord) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to load invoice." }, { status: 404 });
  }

  let invoice = invoiceRecord;

  if (invoice.status === "Paid" || invoice.status === "Void") {
    return NextResponse.json({ ok: false, error: `Invoice cannot be sent from status ${invoice.status}.` }, { status: 400 });
  }

  const requestedDueDate = body.due_date?.trim();
  if (requestedDueDate) {
    if (!isValidIsoDate(requestedDueDate)) {
      return NextResponse.json({ ok: false, error: "Choose a valid payment due date." }, { status: 400 });
    }
    if (invoice.issue_date && requestedDueDate < String(invoice.issue_date).slice(0, 10)) {
      return NextResponse.json({ ok: false, error: "Payment due date cannot be before the invoice issue date." }, { status: 400 });
    }
    if (requestedDueDate !== String(invoice.due_date).slice(0, 10)) {
      const updated = await supabase
        .from("invoices")
        .update({ due_date: requestedDueDate, updated_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .select("*")
        .single();
      if (updated.error || !updated.data) {
        return NextResponse.json({ ok: false, error: updated.error?.message ?? "Unable to update the payment due date." }, { status: 500 });
      }
      invoice = updated.data;
    }
  }

  const bundle = await getJobBundle(invoice.job_id);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Related job bundle not found." }, { status: 404 });
  }

  const toEmail = body.to_email?.trim() || bundle.customer.email?.trim();
  const emailCustomerName = body.email_customer_name?.trim() || bundle.customer.full_name;
  if (!toEmail) {
    return NextResponse.json(
      { ok: false, error: "NO_EMAIL", message: isTestSend ? "Enter an email address for the test send." : "No customer email is saved for this job yet." },
      { status: 400 }
    );
  }

  const artifacts = await persistInvoiceArtifacts(supabase, bundle, invoice);
  const extraAttachments = await loadJobDocumentAttachments(supabase, bundle.job.id, body.attachment_document_ids ?? []);
  const appUrl = getAppUrl();
  const rawInvoiceUrl = toAbsoluteUrl(artifacts.pdfUrl ?? getInvoicePdfHref(invoiceId), appUrl);
  const invoiceUrl = appendInvoiceFileToken(rawInvoiceUrl, invoiceId);
  const dueDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(invoice.due_date));

  let emailResult: Awaited<ReturnType<typeof sendEmail>>;
  try {
    emailResult = await sendEmail({
      to: toEmail,
      subject: `${isTestSend ? "[TEST] " : ""}${invoice.invoice_type === "deposit" ? "Deposit invoice" : invoice.variation_id ? "Additional work invoice" : "Invoice"} ${invoice.invoice_ref} from We Are Roofing UK Ltd`,
      html: invoiceSentEmail({
        customerName: emailCustomerName,
        customerGreeting: emailCustomerName,
        invoiceRef: invoice.invoice_ref,
        invoiceUrl,
        jobTitle: bundle.job.job_title,
        propertyAddress: bundle.job.property_address,
        dueDate,
        total: Math.max(0, Number(invoice.total ?? 0) - Number(invoice.cis_deduction_amount ?? 0)),
        invoiceType: invoice.invoice_type,
        isVariation: Boolean(invoice.variation_id),
        bankName: bundle.business.bank_name,
        bankSortCode: bundle.business.bank_sort_code,
        bankAccount: bundle.business.bank_account,
        bankAccountName: bundle.business.bank_account_name,
        businessPhone: bundle.business.phone,
        businessEmail: bundle.business.email
      }),
      text: `Your invoice ${invoice.invoice_ref} from We Are Roofing UK Ltd is ready. Payment is due by ${dueDate}. Open it here: ${invoiceUrl}`,
      attachments: extraAttachments,
      jobId: bundle.job.id,
      templateType: isTestSend ? "invoice_test" : "invoice_sent",
      log: !isTestSend
    });
  } catch (emailError) {
    return NextResponse.json(
      { ok: false, error: `Invoice email was not sent. ${emailError instanceof Error ? emailError.message : "The email provider rejected it."}` },
      { status: 502 }
    );
  }

  if (isTestSend) {
    return NextResponse.json({
      ok: true,
      invoiceId,
      provider_message_id: emailResult.id,
      pdf_url: artifacts.pdfUrl,
      message: "Test invoice email sent. Invoice status and customer records were not changed."
    });
  }

  await supabase
    .from("invoices")
    .update({
      status: "Sent",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pdf_url: artifacts.pdfUrl ?? invoice.pdf_url
    })
    .eq("id", invoiceId);

  if (toEmail !== (bundle.customer.email ?? "")) {
    await supabase.from("customers").update({ email: toEmail }).eq("id", bundle.customer.id);
  }

  return NextResponse.json({
    ok: true,
    invoiceId,
    provider_message_id: emailResult.id,
    pdf_url: artifacts.pdfUrl,
    message: `Invoice email accepted by ${emailResult.provider === "gmail" ? "Gmail" : "Resend"} and saved.`
  });
}

async function loadJobDocumentAttachments(supabase: ReturnType<typeof createSupabaseAdminClient>, jobId: string, documentIds: string[]) {
  const uniqueIds = [...new Set(documentIds)].slice(0, 5);
  if (!uniqueIds.length) return [];
  const { data, error } = await supabase.from("job_documents").select("id,display_name,storage_bucket,storage_path,mime_type").eq("job_id", jobId).in("id", uniqueIds);
  if (error) throw new Error(error.message);
  const attachments: Array<{ filename: string; content: string; contentType?: string }> = [];
  for (const document of data ?? []) {
    if (!document.storage_bucket || !document.storage_path) continue;
    const download = await supabase.storage.from(document.storage_bucket).download(document.storage_path);
    if (download.error || !download.data) throw new Error(download.error?.message ?? `Could not attach ${document.display_name}.`);
    attachments.push({ filename: document.display_name, content: Buffer.from(await download.data.arrayBuffer()).toString("base64"), contentType: document.mime_type || "application/pdf" });
  }
  return attachments;
}

function getAppUrl() {
  const fallback = "https://we-are-roofing-one.vercel.app";
  const raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || fallback).replace(/\/$/, "");
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "weareroofing.co.uk" ? fallback : url;
  } catch {
    return fallback;
  }
}

function toAbsoluteUrl(pathOrUrl: string, appUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${appUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
