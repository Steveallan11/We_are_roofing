import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { variationQuoteSentEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sendEmail";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobVariationRecord } from "@/lib/types";
import { createVariationPublicToken } from "@/lib/variations/publicLink";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = { params: Promise<{ variationId: string }> };

export async function POST(request: Request, { params }: Props) {
  const { variationId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    to_email?: string;
    customer_name?: string;
    email_customer_name?: string;
    subject?: string;
    message?: string;
  };
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Combined quotation email preview completed." });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("job_variations").select("*").eq("id", variationId).single();
  if (lookup.error || !lookup.data) return NextResponse.json({ ok: false, error: "Additional work not found." }, { status: 404 });
  const anchor = lookup.data as JobVariationRecord;
  if (!anchor.approval_group_id) return NextResponse.json({ ok: false, error: "This item is not part of a combined quotation." }, { status: 400 });

  const grouped = await supabase
    .from("job_variations")
    .select("*")
    .eq("approval_group_id", anchor.approval_group_id)
    .eq("job_id", anchor.job_id)
    .order("created_at", { ascending: true });
  if (grouped.error || !grouped.data?.length) return NextResponse.json({ ok: false, error: grouped.error?.message ?? "The combined quotation could not be loaded." }, { status: 500 });
  const variations = grouped.data as JobVariationRecord[];
  if (variations.some((variation) => variation.status === "Void")) {
    return NextResponse.json({ ok: false, error: "This combined quotation contains a void item and cannot be emailed." }, { status: 400 });
  }

  const bundle = await getJobBundle(anchor.job_id);
  if (!bundle) return NextResponse.json({ ok: false, error: "Related job not found." }, { status: 404 });
  const toEmail = body.to_email?.trim() || bundle.customer.email?.trim();
  if (!toEmail) return NextResponse.json({ ok: false, error: "Add the customer's email address before sending." }, { status: 400 });

  const lead = variations.find((variation) => variation.public_token) ?? variations[0];
  const token = lead.public_token || createVariationPublicToken();
  if (!lead.public_token) {
    const tokenUpdate = await supabase
      .from("job_variations")
      .update({ public_token: token, public_token_created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (tokenUpdate.error) return NextResponse.json({ ok: false, error: tokenUpdate.error.message }, { status: 500 });
  }

  const groupRef = anchor.approval_group_ref || variations[0].approval_group_ref || anchor.variation_ref;
  const awaitingResponse = variations.every((variation) => variation.status === "Sent");
  const variationUrl = `${getAppUrl()}/variation/${lead.id}?token=${encodeURIComponent(token)}`;
  const customerName = body.customer_name?.trim() || bundle.customer.full_name;
  const total = variations.reduce((sum, variation) => sum + Number(variation.total ?? 0), 0);
  const email = await sendEmail({
    to: toEmail,
    subject: body.subject?.trim() || `Additional works quotation ${groupRef} from We Are Roofing UK Ltd`,
    html: variationQuoteSentEmail({
      customerName,
      customerGreeting: body.email_customer_name,
      messageBody: body.message,
      variations,
      quoteRef: groupRef,
      variationUrl,
      propertyAddress: bundle.job.property_address,
      businessPhone: bundle.business.phone,
      businessEmail: bundle.business.email
    }),
    text: `${body.message?.trim() || `Your combined additional works quotation ${groupRef} is ready to review.`}\n\nOpen the secure quotation here: ${variationUrl}`,
    jobId: anchor.job_id,
    templateType: awaitingResponse ? "variation_quote_resent" : "variation_quote_copy"
  });

  if (toEmail !== (bundle.customer.email ?? "")) await supabase.from("customers").update({ email: toEmail }).eq("id", bundle.customer.id);
  await createActivity(supabase, {
    business_id: anchor.business_id,
    job_id: anchor.job_id,
    customer_id: bundle.customer.id,
    quote_id: anchor.quote_id ?? null,
    activity_type: "variation_sent",
    message: `${groupRef} ${awaitingResponse ? "quotation resent for approval" : "quotation copy emailed"} to ${toEmail}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "variation_quote",
    linked_entity_id: anchor.approval_group_id,
    details: { variation_ids: variations.map((variation) => variation.id), to_email: toEmail, provider_message_id: email.id ?? null, total, copy: !awaitingResponse }
  });

  return NextResponse.json({ ok: true, message: awaitingResponse ? `${groupRef} resent for customer approval.` : `${groupRef} quotation copy emailed. Existing approval and invoice statuses were unchanged.`, public_url: variationUrl });
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
