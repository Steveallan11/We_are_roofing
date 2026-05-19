import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { MoneyWorkspace } from "@/components/money/money-workspace";
import { RateCardNudge } from "@/components/settings/RateCardNudge";
import { getJobs, getPricingRules } from "@/lib/data";
import { currency } from "@/lib/utils";

export default async function MoneyPage() {
  const [jobs, pricingRules] = await Promise.all([getJobs(), getPricingRules()]);
  const hasRateCard = pricingRules.some((rule) => rule.rule_name && rule.flat_adjustment != null);
  const quotes = jobs.flatMap((job) => (job.quote ? [job.quote] : []));
  const invoices = jobs.flatMap((job) => job.invoices ?? []);
  const quotePipeline = quotes.reduce((sum, quote) => sum + Number(quote.total ?? 0), 0);
  const outstanding = invoices
    .filter((invoice) => !["Paid", "Void"].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.balance_due ?? invoice.total ?? 0), 0);

  return (
    <AppShell
      title="Money"
      subtitle={`${quotes.length} quotes | ${invoices.length} invoices | ${currency(quotePipeline)} quoted | ${currency(outstanding)} outstanding.`}
      wide
      actions={
        <>
          <Link className="button-primary" href={"/settings/rates" as Route}>
            Rate Card
          </Link>
          <Link className="button-ghost" href={"/jobs" as Route}>
            Open Jobs
          </Link>
        </>
      }
    >
      {!hasRateCard ? <RateCardNudge /> : null}
      <MoneyWorkspace jobs={jobs} />
    </AppShell>
  );
}
