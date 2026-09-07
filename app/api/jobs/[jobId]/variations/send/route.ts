import { randomUUID } from "crypto";
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

type Props = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    variation_ids?: string[];
    to_email?: string;
    customer_name?: string;
    email_customer_name?: string;
    subject?: string;
    message?: string;
  };
  const variationIds = [...new Set((body.variation_ids ?? []).filter(Boolean))];
  if (variationIds.length < 2) {
    return NextResponse.json({ ok: false, error: "Select at least two draft additional-work items to combine." }, { status: 400 });
  }
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Combined additional-works quote preview created." });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const bundle = await getJobBundle(jobId);
  if (!bundle) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });

  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("job_variations").select("*").in("id", variationIds);
  if (lookup.error) return NextResponse.json({ ok: false, error: lookup.error.message }, { status: 500 });
  const variations = (lookup.data as JobVariationRecord[] | null) ?? [];
  if (variations.length !== variationIds.length || variations.some((variation) => variation.job_id !== jobId)) {
    return NextResponse.json({ ok: false, error: "One or more selected items could not be found on this job." }, { status: 400 });
  }
  if (variations.some((variation) => variation.status !== "Draft" || variation.approval_group_id)) {
    return NextResponse.json({ ok: false, error: "Only ungrouped draft items can be included in a new combined quote." }, { status: 400 });
  }

  const toEmail = body.to_email?.trim() || bundle.customer.email?.trim();
  if (!toEmail) return NextResponse.json({ ok: false, error: "Add the customer's email address before sending." }, { status: 400 });

  const groupId = randomUUID();
  const groupRef = buildGroupRef(bundle.job.job_ref, groupId);
  const token = createVariationPublicToken();
  const now = new Date().toISOString();
  const orderedVariations = [...variations].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  const leadVariationId = orderedVariations[0].id;
  const grouped = await supabase
    .from("job_variations")
    .update({
      approval_group_id: groupId,
      approval_group_ref: groupRef,
      updated_at: now
    })
    .in("id", variationIds)
    .eq("status", "Draft")
    .is("approval_group_id", null)
    .select("id");
  if (grouped.error || grouped.data?.length !== variationIds.length) {
    return NextResponse.json({ ok: false, error: grouped.error?.message ?? "The selected items changed. Refresh and try again." }, { status: 409 });
  }

  const tokenUpdate = await supabase
    .from("job_variations")
    .update({ public_token: token, public_token_created_at: now, updated_at: now })
    .eq("id", leadVariationId);
  if (tokenUpdate.error) {
    await supabase
      .from("job_variations")
      .update({ approval_group_id: null, approval_group_ref: null, updated_at: new Date().toISOString() })
      .eq("approval_group_id", groupId);
    return NextResponse.json({ ok: false, error: tokenUpdate.error.message }, { status: 500 });
  }

  const variationUrl = `${getAppUrl()}/variation/${leadVariationId}?token=${encodeURIComponent(token)}`;
  const customerName = body.customer_name?.trim() || bundle.customer.full_name;
  const total = orderedVariations.reduce((sum, variation) => sum + Number(variation.total ?? 0), 0);

  try {
    const email = await sendEmail({
      to: toEmail,
      subject: body.subject?.trim() || `Additional works quotation ${groupRef} from We Are Roofing UK Ltd`,
      html: variationQuoteSentEmail({
        customerName,
        customerGreeting: body.email_customer_name,
        messageBody: body.message,
        variations: orderedVariations,
        quoteRef: groupRef,
        variationUrl,
        propertyAddress: bundle.job.property_address,
        businessPhone: bundle.business.phone,
        businessEmail: bundle.business.email
      }),
      text: `${body.message?.trim() || `Your combined additional works quotation ${groupRef} is ready to review.`}\n\nOpen the secure quotation here: ${variationUrl}`,
      jobId,
      templateType: "variation_quote_sent"
    });

    const sent = await supabase
      .from("job_variations")
      .update({ status: "Sent", sent_at: now, updated_at: now })
      .eq("approval_group_id", groupId)
      .eq("status", "Draft")
      .select("id");
    if (sent.error || sent.data?.length !== variationIds.length) {
      return NextResponse.json({ ok: false, error: sent.error?.message ?? "The email was sent, but the quote status could not be updated. Please contact support before resending." }, { status: 500 });
    }

    if (toEmail !== (bundle.customer.email ?? "")) await supabase.from("customers").update({ email: toEmail }).eq("id", bundle.customer.id);
    await createActivity(supabase, {
      business_id: bundle.business.id,
      job_id: jobId,
      customer_id: bundle.customer.id,
      quote_id: bundle.quote?.id ?? null,
      activity_type: "variation_sent",
      message: `${groupRef} sent to ${toEmail} with ${variationIds.length} additional-work items`,
      actor_type: "user",
      actor_id: auth.session.user?.id ?? null,
      actor_name: auth.session.user?.email ?? null,
      linked_entity_type: "variation_quote",
      linked_entity_id: groupId,
      details: { variation_ids: variationIds, to_email: toEmail, provider_message_id: email.id ?? null, total }
    });

    return NextResponse.json({ ok: true, message: `${groupRef} sent as one combined quotation.`, public_url: variationUrl });
  } catch (error) {
    await supabase
      .from("job_variations")
      .update({ approval_group_id: null, approval_group_ref: null, public_token: null, public_token_created_at: null, updated_at: new Date().toISOString() })
      .eq("approval_group_id", groupId)
      .eq("status", "Draft");
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "The combined quotation could not be sent." }, { status: 500 });
  }
}

function buildGroupRef(jobRef: string | null | undefined, id: string) {
  const base = (jobRef || "WR").replace(/[^a-z0-9-]/gi, "").toUpperCase();
  return `${base}-VQ-${id.slice(0, 5).toUpperCase()}`;
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
