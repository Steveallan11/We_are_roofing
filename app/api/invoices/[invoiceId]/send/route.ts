import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getJobBundle } from "@/lib/data";
import { invoiceSentEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sendEmail";
import { persistInvoiceArtifacts } from "@/lib/invoice-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ invoiceId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { invoiceId } = await params;
  const body = (await request.json().catch(() => ({}))) as { to_email?: string; test?: boolean };
  const isTestSend = body.test === true;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Invoice send preview completed.", invoiceId });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (error || !invoice) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to load invoice." }, { status: 404 });
  }

  if (invoice.status === "Paid" || invoice.status === "Void") {
    return NextResponse.json({ ok: false, error: `Invoice cannot be sent from status ${invoice.status}.` }, { status: 400 });
  }

  const bundle = await getJobBundle(invoice.job_id);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Related job bundle not found." }, { status: 404 });
  }

  const toEmail = body.to_email?.trim() || bundle.customer.email?.trim();
  if (!toEmail) {
    return NextResponse.json(
      { ok: false, error: "NO_EMAIL", message: isTestSend ? "Enter an email address for the test send." : "No customer email is saved for this job yet." },
      { status: 400 }
    );
  }

  const artifacts = await persistInvoiceArtifacts(supabase, bundle, invoice);
  const appUrl = getAppUrl();
  const invoiceUrl = toAbsoluteUrl(artifacts.pdfUrl ?? `/jobs/${bundle.job.id}/invoice/${invoiceId}/preview`, appUrl);
  const dueDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(invoice.due_date));

  const emailResult = await sendEmail({
    to: toEmail,
    subject: `${isTestSend ? "[TEST] " : ""}${invoice.invoice_type === "deposit" ? "Deposit invoice" : "Invoice"} ${invoice.invoice_ref} from We Are Roofing UK Ltd`,
    html: invoiceSentEmail({
      customerName: bundle.customer.full_name,
      invoiceRef: invoice.invoice_ref,
      invoiceUrl,
      jobTitle: bundle.job.job_title,
      propertyAddress: bundle.job.property_address,
      dueDate,
      total: Number(invoice.total ?? 0),
      invoiceType: invoice.invoice_type,
      bankName: bundle.business.bank_name,
      bankSortCode: bundle.business.bank_sort_code,
      bankAccount: bundle.business.bank_account,
      bankAccountName: bundle.business.bank_account_name,
      businessPhone: bundle.business.phone,
      businessEmail: bundle.business.email
    }),
    text: `Your invoice ${invoice.invoice_ref} from We Are Roofing UK Ltd is ready. Open it here: ${invoiceUrl}`,
    jobId: bundle.job.id,
    templateType: isTestSend ? "invoice_test" : "invoice_sent",
    log: !isTestSend
  });

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
    message: process.env.RESEND_API_KEY
      ? "Invoice email sent and saved."
      : "Invoice send logged in Supabase. RESEND_API_KEY not configured, so no provider email was sent."
  });
}

function getAppUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://we-are-roofing-one.vercel.app").replace(/\/$/, "");
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function toAbsoluteUrl(pathOrUrl: string, appUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${appUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}
