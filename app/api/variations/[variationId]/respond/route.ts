import { NextResponse } from "next/server";
import { createActivity } from "@/lib/activity/createActivity";
import { getJobBundle } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobVariationRecord } from "@/lib/types";
import { verifyVariationPublicToken } from "@/lib/variations/publicLink";
import { updateJobValueWithVariations } from "@/lib/variations/updateJobValue";

type Props = { params: Promise<{ variationId: string }> };

export async function POST(request: Request, { params }: Props) {
  const { variationId } = await params;
  const body = (await request.json().catch(() => ({}))) as { token?: string; decision?: "accept" | "decline"; name?: string; email?: string };
  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("job_variations").select("*").eq("id", variationId).single();
  if (lookup.error || !lookup.data) return NextResponse.json({ ok: false, error: "Additional work not found." }, { status: 404 });
  const variation = lookup.data as JobVariationRecord;
  if (!verifyVariationPublicToken(variation.public_token, body.token)) {
    return NextResponse.json({ ok: false, error: "This approval link is invalid." }, { status: 403 });
  }
  if (variation.status === "Accepted" || variation.status === "Invoiced" || variation.status === "Paid") {
    return NextResponse.json({ ok: true, message: "This additional work has already been accepted." });
  }
  if (variation.status !== "Sent") return NextResponse.json({ ok: false, error: "This additional work is no longer awaiting a response." }, { status: 400 });
  if (body.decision !== "accept" && body.decision !== "decline") return NextResponse.json({ ok: false, error: "Choose accept or decline." }, { status: 400 });
  const name = body.name?.trim();
  const email = body.email?.trim();
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter your full name and a valid email address." }, { status: 400 });
  }

  const accepted = body.decision === "accept";
  const now = new Date().toISOString();
  const update = await supabase
    .from("job_variations")
    .update({
      status: accepted ? "Accepted" : "Declined",
      approval_method: "online",
      approved_by_name: name,
      approved_by_email: email,
      accepted_at: accepted ? now : null,
      declined_at: accepted ? null : now,
      updated_at: now
    })
    .eq("id", variation.id)
    .eq("status", "Sent")
    .select("*")
    .maybeSingle();
  if (update.error) return NextResponse.json({ ok: false, error: update.error.message }, { status: 500 });
  if (!update.data) return NextResponse.json({ ok: true, message: "Your response has already been recorded." });

  await updateJobValueWithVariations(supabase, variation.job_id);

  const bundle = await getJobBundle(variation.job_id);
  await createActivity(supabase, {
    business_id: variation.business_id,
    job_id: variation.job_id,
    customer_id: bundle?.customer.id ?? null,
    quote_id: variation.quote_id ?? null,
    activity_type: accepted ? "variation_accepted" : "variation_declined",
    message: `${variation.variation_ref} ${accepted ? "accepted" : "declined"} online by ${name}`,
    actor_type: "customer",
    actor_name: name,
    linked_entity_type: "variation",
    linked_entity_id: variation.id,
    details: { email, total: variation.total }
  });
  return NextResponse.json({ ok: true, message: accepted ? "Thank you. Your approval has been recorded." : "Your decision has been recorded. We will be in touch." });
}
