import type { CostLineItem } from "@/lib/types";
import { normaliseRateName } from "@/lib/pricing/rateCard";

type SupabaseLike = {
  from: (table: string) => any;
};

type LearnFromQuoteInput = {
  supabase: SupabaseLike;
  businessId: string;
  jobId?: string | null;
  quoteId?: string | null;
  lines: CostLineItem[];
  sourceType?: "quote_save" | "quote_accept";
};

type LearnFromMaterialInput = {
  supabase: SupabaseLike;
  businessId: string;
  jobId?: string | null;
  materialId?: string | null;
  itemName: string;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  totalCost?: number | null;
};

const REVIEW_THRESHOLD_PCT = 35;
const AUTO_BLEND_WEIGHT = 0.25;

export async function learnPricingFromQuote({ supabase, businessId, jobId, quoteId, lines, sourceType = "quote_save" }: LearnFromQuoteInput) {
  const notes: string[] = [];
  for (const line of lines) {
    const observation = getObservationFromLine(line);
    if (!observation) continue;

    const result = await learnObservedRate({
      supabase,
      businessId,
      jobId,
      quoteId,
      sourceType,
      ...observation
    });

    if (result?.reviewNote) notes.push(result.reviewNote);
  }

  return { notes };
}

export async function learnPricingFromMaterial({ supabase, businessId, jobId, materialId, itemName, category, quantity, unit, unitCost, totalCost }: LearnFromMaterialInput) {
  const observedRate = Number(unitCost || 0);
  const observedTotal = Number(totalCost || (Number(quantity || 0) * observedRate));
  if (!itemName.trim() || observedRate <= 0) return null;

  return learnObservedRate({
    supabase,
    businessId,
    jobId,
    materialId,
    sourceType: "material",
    itemName,
    ruleType: category || "Material",
    unit: unit || "item",
    quantity: Number(quantity || 1),
    observedRate,
    observedTotal
  });
}

function getObservationFromLine(line: CostLineItem) {
  if (line.pricing_source === "labour_plan") return null;

  const itemName = String(line.item || "").trim();
  const observedTotal = Number(line.cost || 0);
  if (!itemName || observedTotal <= 0) return null;

  const quantity = getQuantity(line);
  if (quantity <= 0) return null;

  const observedRate = Number(line.unit_rate || 0) > 0 ? Number(line.unit_rate || 0) : observedTotal / quantity;
  if (!Number.isFinite(observedRate) || observedRate <= 0) return null;

  return {
    itemName,
    ruleType: inferRuleType(line),
    unit: line.unit || (quantity === 1 ? "item" : "item"),
    quantity,
    observedRate: roundMoney(observedRate),
    observedTotal
  };
}

async function learnObservedRate({
  supabase,
  businessId,
  jobId,
  quoteId,
  materialId,
  sourceType,
  itemName,
  ruleType,
  unit,
  quantity,
  observedRate,
  observedTotal
}: {
  supabase: SupabaseLike;
  businessId: string;
  jobId?: string | null;
  quoteId?: string | null;
  materialId?: string | null;
  sourceType: string;
  itemName: string;
  ruleType: string;
  unit: string;
  quantity: number;
  observedRate: number;
  observedTotal: number;
}) {
  const existing = await findExistingRule(supabase, businessId, itemName, ruleType);
  const existingRate = Number(existing?.flat_adjustment || 0);
  const discrepancyPct = existingRate > 0 ? Math.abs(observedRate - existingRate) / existingRate * 100 : 0;
  let actionTaken = "created";
  let reviewNote: string | null = null;
  let pricingRuleId = existing?.id ?? null;

  if (!existing) {
    const { data, error } = await supabase
      .from("pricing_rules")
      .insert({
        business_id: businessId,
        title: itemName,
        rule_name: itemName,
        rule_type: ruleType,
        conditions: { unit, learned: true },
        flat_adjustment: observedRate,
        uplift_multiplier: 1,
        active: true
      })
      .select("id")
      .maybeSingle();

    if (!error) pricingRuleId = data?.id ?? null;
  } else if (existingRate > 0 && discrepancyPct > REVIEW_THRESHOLD_PCT) {
    actionTaken = "review_needed";
    reviewNote = `Rate check: ${itemName} was charged at £${observedRate.toFixed(2)}/${unit}, ${Math.round(discrepancyPct)}% away from Rate Card £${existingRate.toFixed(2)}. Review before updating Gauge costing.`;
    await safeUpdateRuleObservation(supabase, existing.id, observedRate, false);
  } else {
    actionTaken = "updated";
    const nextRate = existingRate > 0 ? roundMoney(existingRate * (1 - AUTO_BLEND_WEIGHT) + observedRate * AUTO_BLEND_WEIGHT) : observedRate;
    await safeUpdateRuleObservation(supabase, existing.id, nextRate, true);
  }

  await recordObservation(supabase, {
    business_id: businessId,
    pricing_rule_id: pricingRuleId,
    quote_id: quoteId || null,
    job_id: jobId || null,
    material_id: materialId || null,
    source_type: sourceType,
    item_name: itemName,
    rule_type: ruleType,
    unit,
    quantity,
    observed_rate: observedRate,
    observed_total: observedTotal,
    existing_rate: existingRate || null,
    discrepancy_pct: roundMoney(discrepancyPct),
    action_taken: actionTaken
  });

  return { actionTaken, reviewNote };
}

async function findExistingRule(supabase: SupabaseLike, businessId: string, itemName: string, ruleType: string) {
  const { data } = await supabase
    .from("pricing_rules")
    .select("id, rule_name, rule_type, flat_adjustment, learned_from_count")
    .eq("business_id", businessId)
    .not("rule_name", "is", null);

  const rules = (data as Array<{ id: string; rule_name?: string | null; rule_type?: string | null; flat_adjustment?: number | null; learned_from_count?: number | null }> | null) ?? [];
  const key = normaliseRateName(itemName);
  const type = normaliseRateName(ruleType);
  return (
    rules.find((rule) => normaliseRateName(rule.rule_name || "") === key && normaliseRateName(rule.rule_type || "") === type) ??
    rules.find((rule) => {
      const name = normaliseRateName(rule.rule_name || "");
      return name === key || key.includes(name) || name.includes(key);
    }) ??
    null
  );
}

async function safeUpdateRuleObservation(supabase: SupabaseLike, ruleId: string, nextRate: number, updateRate: boolean) {
  if (!updateRate) return;
  const payload: Record<string, unknown> = { flat_adjustment: nextRate };

  await supabase.from("pricing_rules").update(payload).eq("id", ruleId);
}

async function recordObservation(supabase: SupabaseLike, row: Record<string, unknown>) {
  await supabase.from("pricing_rule_observations").insert(row);
}

function inferRuleType(line: CostLineItem) {
  if (line.pricing_category) {
    const category = normaliseRateName(line.pricing_category);
    if (category.includes("material")) return "Material";
    if (category.includes("labour")) return "Labour";
    if (category.includes("scaffold") || category.includes("access")) return "Fixed";
    if (category.includes("roof works")) return inferRuleTypeFromUnit(line.unit);
    return line.pricing_category;
  }
  return inferRuleTypeFromUnit(line.unit);
}

function inferRuleTypeFromUnit(unit?: string | null) {
  const clean = normaliseRateName(unit || "");
  if (clean.includes("m2") || clean.includes("m²") || clean.includes("sqm")) return "Area";
  if (clean === "lm" || clean === "m" || clean.includes("linear")) return "Linear";
  return "Fixed";
}

function getQuantity(line: CostLineItem) {
  if (typeof line.quantity === "number" && Number.isFinite(line.quantity) && line.quantity > 0) return line.quantity;
  if (Number(line.unit_rate || 0) > 0 && Number(line.cost || 0) > 0) return Number(line.cost || 0) / Number(line.unit_rate || 1);
  return 1;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
