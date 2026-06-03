import { AppShell } from "@/components/layout/app-shell";
import { MoneyTabs } from "@/components/money/MoneyTabs";
import { RateCardNudge } from "@/components/settings/RateCardNudge";
import { getJobs, getPricingRules } from "@/lib/data";
import { getQuotePipelineValue } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";

export default async function MoneyPage() {
  const [jobs, pricingRules] = await Promise.all([getJobs(), getPricingRules()]);
  const hasRateCard = pricingRules.some((rule) => rule.rule_name && rule.flat_adjustment != null);
  const quotes = jobs.flatMap((job) => (job.quote ? [job.quote] : []));
  const invoices = jobs.flatMap((job) => job.invoices ?? []);
  const quotePipeline = quotes.reduce((sum, quote) => sum + Number(getQuotePipelineValue(quote) ?? 0), 0);
  const outstanding = invoices
    .filter((invoice) => !["Paid", "Void"].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.balance_due ?? invoice.total ?? 0), 0);

  return (
    <AppShell
      title="Money"
      subtitle={`${currency(quotePipeline)} pipeline | ${currency(outstanding)} outstanding. Revenue, expenses, invoices, and forecast.`}
      wide
    >
      {!hasRateCard ? <RateCardNudge /> : null}
      <MoneyTabs jobs={jobs} />
    </AppShell>
  );
}
