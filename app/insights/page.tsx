import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { Button, Card, CardBody, CardHeader, CardTitle, Stat, PageSection } from "@/components/ui/primitives";
import { currency, formatDate } from "@/lib/utils";
import { getBusinessMetrics } from "@/lib/insights";

type Props = {
  searchParams?: Promise<{ period?: string }>;
};

export const metadata = {
  title: "Business Insights"
};

export default async function InsightsPage({ searchParams }: Props) {
  const query = await searchParams;
  const period = (query?.period as "7d" | "30d" | "90d" | "ytd") ?? "30d";

  const metrics = await getBusinessMetrics(period);

  return (
    <AppShell
      title="Business Insights"
      subtitle="Key metrics and performance indicators for your roofing business."
      actions={
        <div className="flex flex-wrap gap-2">
          {(["7d", "30d", "90d", "ytd"] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? "primary" : "secondary"}
              size="sm"
              asChild
            >
              <Link href={`/insights?period=${p}` as Route}>
                {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : "Year to Date"}
              </Link>
            </Button>
          ))}
        </div>
      }
    >
      <div className="space-y-6">
        <PageSection kicker="Overview" title="Key Metrics">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Total Revenue"
              value={currency(metrics.totalRevenue)}
              trend={
                metrics.revenueChange !== 0
                  ? { value: `${Math.abs(metrics.revenueChange).toFixed(0)}%`, direction: metrics.revenueChange >= 0 ? "up" : "down" }
                  : undefined
              }
            />
            <Stat
              label="Invoiced Amount"
              value={currency(metrics.invoicedAmount)}
              trend={
                metrics.invoiceChange !== 0
                  ? { value: `${Math.abs(metrics.invoiceChange).toFixed(0)}%`, direction: metrics.invoiceChange >= 0 ? "up" : "down" }
                  : undefined
              }
            />
            <Stat
              label="Average Job Value"
              value={currency(metrics.avgJobValue)}
              trend={
                metrics.avgJobValueChange !== 0
                  ? { value: `${Math.abs(metrics.avgJobValueChange).toFixed(0)}%`, direction: metrics.avgJobValueChange >= 0 ? "up" : "down" }
                  : undefined
              }
            />
            <Stat
              label="Conversion Rate"
              value={`${Math.round(metrics.conversionRate)}%`}
              trend={
                metrics.conversionRateChange !== 0
                  ? { value: `${Math.abs(metrics.conversionRateChange).toFixed(0)}%`, direction: metrics.conversionRateChange >= 0 ? "up" : "down" }
                  : undefined
              }
            />
          </div>
        </PageSection>

        <PageSection kicker="Activity" title="Job Pipeline">
          <div className="grid gap-4 md:grid-cols-3">
            <Card variant="default">
              <CardHeader>
                <CardTitle className="text-lg">New Leads</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-4xl font-bold text-[var(--gold)]">{metrics.newLeads}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {metrics.newLeadsChange > 0 ? "+" : ""}{metrics.newLeadsChange} from last period
                </p>
              </CardBody>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle className="text-lg">Quotes Sent</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-4xl font-bold text-[#3b82f6]">{metrics.quotesSent}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {metrics.quotesAccepted} accepted ({Math.round((metrics.quotesAccepted / Math.max(metrics.quotesSent, 1)) * 100)}%)
                </p>
              </CardBody>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle className="text-lg">Jobs Completed</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-4xl font-bold text-[#10b981]">{metrics.jobsCompleted}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {metrics.jobsCompletedChange > 0 ? "+" : ""}{metrics.jobsCompletedChange} from last period
                </p>
              </CardBody>
            </Card>
          </div>
        </PageSection>

        <PageSection kicker="Performance" title="Time Metrics">
          <div className="grid gap-4 md:grid-cols-2">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Average Quote Time</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-3xl font-bold">{metrics.avgQuoteTime} days</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">From survey to quote sent</p>
              </CardBody>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Average Job Duration</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-3xl font-bold">{metrics.avgJobDuration} days</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">From quote accepted to completion</p>
              </CardBody>
            </Card>
          </div>
        </PageSection>

        <PageSection kicker="Breakdown" title="Revenue by Job Type">
          <Card variant="default">
            <CardBody>
              <div className="space-y-3">
                {Object.entries(metrics.revenueByJobType).map(([type, amount]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-muted)]">{type || "Other"}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-[var(--gold)]"
                          style={{
                            width: `${(amount / Math.max(...Object.values(metrics.revenueByJobType), 1)) * 100}%`
                          }}
                        />
                      </div>
                      <span className="min-w-[80px] text-right text-sm font-semibold">{currency(amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </PageSection>

        <PageSection kicker="Expenses" title="Cost Breakdown">
          <Card variant="default">
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {[
                  { label: "Materials", amount: metrics.materialsCost, color: "text-[#10b981]" },
                  { label: "Labour", amount: metrics.labourCost, color: "text-[#3b82f6]" },
                  { label: "Subcontractors", amount: metrics.subcontractorCost, color: "text-[#f59e0b]" }
                ].map(({ label, amount, color }) => (
                  <div key={label}>
                    <p className="text-sm text-[var(--text-muted)]">{label}</p>
                    <p className={`mt-1 text-2xl font-bold ${color}`}>{currency(amount)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {Math.round((amount / metrics.totalRevenue) * 100)}% of revenue
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </PageSection>
      </div>
    </AppShell>
  );
}
