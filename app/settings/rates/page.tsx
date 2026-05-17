import Link from "next/link";
import { RateCardEditor } from "@/components/settings/rate-card-editor";
import { AppShell } from "@/components/layout/app-shell";
import { getPricingRules } from "@/lib/data";
import { DEFAULT_RATES, mergeRateCardWithDefaults, pricingRulesToRateCard } from "@/lib/pricing/rateCard";

export default async function RateCardPage() {
  const rules = await getPricingRules();
  const savedRateRules = rules.filter((rule) => rule.rule_name && rule.flat_adjustment != null);
  const rates = savedRateRules.length
    ? mergeRateCardWithDefaults(pricingRulesToRateCard(savedRateRules))
    : DEFAULT_RATES.map((rate) => ({ ...rate, rate: rate.default_rate, active: true }));

  return (
    <AppShell
      title="Rate Card"
      subtitle="Set the unit rates Gauge and the quote builder use to price survey takeoffs. Without this, imported BOM lines stay at £0."
      actions={
        <Link className="button-ghost" href="/dashboard">
          Back to Dashboard
        </Link>
      }
    >
      <RateCardEditor hasSavedRates={savedRateRules.length > 0} initialRates={rates} />
    </AppShell>
  );
}
