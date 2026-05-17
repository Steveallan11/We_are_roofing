import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";
import {
  applyRateCardToCostBreakdown,
  calculateQuoteTotals,
  DEFAULT_RATES,
  mergeRateCardWithDefaults,
  pricingRulesToRateCard,
  type RateCardEntry
} from "@/lib/pricing/rateCard";
import type { CostLineItem, PricingRuleRecord, QuoteRecord } from "@/lib/types";

type SaveRatesBody = {
  rates?: RateCardEntry[];
};

export async function GET() {
  const business = await getBusiness();

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      rates: DEFAULT_RATES.map((rate) => ({ ...rate, rate: rate.default_rate, active: true })),
      hasSavedRates: false
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("business_id", business.id)
    .not("rule_name", "is", null)
    .order("rule_type", { ascending: true })
    .order("rule_name", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const savedRates = pricingRulesToRateCard((data as PricingRuleRecord[] | null) ?? []);
  return NextResponse.json({ ok: true, rates: mergeRateCardWithDefaults(savedRates), hasSavedRates: Boolean(data?.length) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SaveRatesBody;
  const business = await getBusiness();
  const rates = (body.rates?.length ? body.rates : DEFAULT_RATES.map((rate) => ({ ...rate, rate: rate.default_rate, active: true }))).map((rate) => ({
    ...rate,
    rate: Number(rate.rate || rate.default_rate || 0)
  }));

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, rates, repricedQuotes: 0 });
  }

  const supabase = createSupabaseAdminClient();
  const rows = rates.map((rate) => ({
    business_id: business.id,
    title: rate.item,
    rule_name: rate.item,
    rule_type: rate.category,
    conditions: { unit: rate.unit },
    flat_adjustment: rate.rate,
    uplift_multiplier: 1,
    active: rate.active !== false,
    notes: "Rate Card unit price"
  }));

  const { error } = await supabase.from("pricing_rules").upsert(rows, { onConflict: "business_id,rule_name,rule_type" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const repricedQuotes = await repriceZeroCostQuotes(business.id, rates);
  return NextResponse.json({ ok: true, rates, repricedQuotes });
}

async function repriceZeroCostQuotes(businessId: string, rates: RateCardEntry[]) {
  const supabase = createSupabaseAdminClient();
  const { data: jobs } = await supabase.from("jobs").select("id").eq("business_id", businessId);
  const jobIds = ((jobs as Array<{ id: string }> | null) ?? []).map((job) => job.id);
  if (jobIds.length === 0) return 0;

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .in("job_id", jobIds)
    .in("status", ["Draft", "Needs Review", "Quote Drafted", "Ready To Send"]);

  let count = 0;
  for (const quote of ((quotes as QuoteRecord[] | null) ?? [])) {
    const lines = quote.cost_breakdown ?? [];
    if (!lines.some((line) => Number(line.cost || 0) === 0)) continue;

    const { updated, pricingNotes } = applyRateCardToCostBreakdown(lines as CostLineItem[], rates);
    if (!pricingNotes.length) continue;

    const totals = calculateQuoteTotals(updated);
    const existingNotes = Array.isArray(quote.pricing_notes) ? quote.pricing_notes : [];
    const { error } = await supabase
      .from("quotes")
      .update({
        cost_breakdown: updated,
        subtotal: totals.subtotal,
        vat_amount: totals.vat_amount,
        total: totals.total,
        pricing_notes: [...existingNotes, ...pricingNotes],
        updated_at: new Date().toISOString()
      })
      .eq("id", quote.id);

    if (!error) {
      await supabase.from("jobs").update({ estimated_value: totals.total, updated_at: new Date().toISOString() }).eq("id", quote.job_id);
      count += 1;
    }
  }

  return count;
}
