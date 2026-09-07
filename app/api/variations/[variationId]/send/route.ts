import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { variationSentEmail } from "@/lib/email/templates";
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
    test?: boolean;
  };
  const isTest = body.test === true;

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Additional work email preview completed." });
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("job_variations").select("*").eq("id", variationId).single();
  if (lookup.error || !lookup.data) return NextResponse.json({ ok: false, error: lookup.error?.message ?? "Additional work not found." }, { status: 404 });
  const variation = lookup.data as JobVariationRecord;
  if (variation.approval_group_id) {
    return NextResponse.json({ ok: false, error: `This item belongs to combined quote ${variation.approval_group_ref || ""}. Resend the combined quotation rather than sending this item separately.` }, { status: 400 });
  }
  if (!["Draft", "Sent"].includes(variation.status)) {
    return NextResponse.json({ ok: false, error: `This additional work is already ${variation.status.toLowerCase()}.` }, { status: 400 });
  }

  const bundle = await getJobBundle(variation.job_id);
  if (!bundle) return NextResponse.json({ ok: false, error: "Related job not found." }, { status: 404 });
  const toEmail = body.to_email?.trim() || bundle.customer.email?.trim();
  if (!toEmail) return NextResponse.json({ ok: false, error: "Add the customer's email address before sending." }, { status: 400 });

  const token = variation.public_token || createVariationPublicToken();
  const variationUrl = `${getAppUrl()}/variation/${variation.id}?token=${encodeURIComponent(token)}`;
  const customerName = body.customer_name?.trim() || bundle.customer.full_name;
  if (!variation.public_token) {
    const tokenUpdate = await supabase
      .from("job_variations")
      .update({ public_token: token, public_token_created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", variation.id);
    if (tokenUpdate.error) return NextResponse.json({ ok: false, error: tokenUpdate.error.message }, { status: 500 });
  }
  const email = await sendEmail({
    to: toEmail,
    subject: `${isTest ? "[TEST] " : ""}${body.subject?.trim() || `Additional work quotation - ${variation.variation_ref}`}`,
    html: variationSentEmail({
      customerName,
      customerGreeting: body.email_customer_name,
      messageBody: body.message,
      variation,
      variationUrl,
      propertyAddress: bundle.job.property_address,
      businessPhone: bundle.business.phone,
      businessEmail: bundle.business.email
    }),
    text: `${body.message?.trim() || `Additional work ${variation.variation_ref} is ready to review.`}\n\nOpen the secure quotation here: ${variationUrl}`,
    jobId: variation.job_id,
    templateType: isTest ? "variation_test" : "variation_sent",
    log: !isTest
  });

  if (isTest) return NextResponse.json({ ok: true, message: "Test additional work email sent. Its status was not changed.", public_url: variationUrl });

  const now = new Date().toISOString();
  const update = await supabase
    .from("job_variations")
    .update({ status: "Sent", sent_at: now, updated_at: now })
    .eq("id", variation.id)
    .select("*")
    .single();
  if (update.error) return NextResponse.json({ ok: false, error: update.error.message }, { status: 500 });

  if (toEmail !== (bundle.customer.email ?? "")) await supabase.from("customers").update({ email: toEmail }).eq("id", bundle.customer.id);
  await createActivity(supabase, {
    business_id: variation.business_id,
    job_id: variation.job_id,
    customer_id: bundle.customer.id,
    quote_id: variation.quote_id ?? null,
    activity_type: "variation_sent",
    message: `${variation.variation_ref} sent to ${toEmail}`,
    actor_type: "user",
    actor_id: auth.session.user?.id ?? null,
    actor_name: auth.session.user?.email ?? null,
    linked_entity_type: "variation",
    linked_entity_id: variation.id,
    details: { to_email: toEmail, provider_message_id: email.id ?? null, total: variation.total }
  });

  return NextResponse.json({ ok: true, message: "Additional work sent for customer approval.", public_url: variationUrl });
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
