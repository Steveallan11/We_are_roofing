import { AppShell } from "@/components/layout/app-shell";
import { MoneyTabs } from "@/components/money/MoneyTabs";
import { RateCardNudge } from "@/components/settings/RateCardNudge";
import { getAllExpenses, getAllInvoices, getBankStatementImports, getBusiness, getCustomers, getJobFinancialSnapshots, getJobs, getLabourPeople, getPricingRules, getReceiptInbox, getSubcontractorPayments, getSupplierBills, getSuppliers } from "@/lib/data";
import { getQuotePipelineValue } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";

export default async function MoneyPage() {
  const [jobs, pricingRules, expenses, receiptInbox, jobFinancials, labourPeople, subcontractorPayments, suppliers, supplierBills, bankStatementImports, customers, allInvoices, business] = await Promise.all([
    getJobs(),
    getPricingRules(),
    getAllExpenses(),
    getReceiptInbox(),
    getJobFinancialSnapshots(),
    getLabourPeople(),
    getSubcontractorPayments(),
    getSuppliers(),
    getSupplierBills(),
    getBankStatementImports(),
    getCustomers(),
    getAllInvoices(),
    getBusiness()
  ]);
  const hasRateCard = pricingRules.some((rule) => rule.rule_name && rule.flat_adjustment != null);
  const quotes = jobs.flatMap((job) => (job.quote ? [job.quote] : []));
  const invoices = allInvoices.length ? allInvoices : jobs.flatMap((job) => job.invoices ?? []);
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
      <MoneyTabs
        jobs={jobs}
        expenses={expenses}
        receiptInbox={receiptInbox}
        jobFinancials={jobFinancials}
        labourPeople={labourPeople}
        subcontractorPayments={subcontractorPayments}
        suppliers={suppliers}
        supplierBills={supplierBills}
        bankStatementImports={bankStatementImports}
        customers={customers}
        allInvoices={allInvoices}
        vatRate={business.vat_registered ? Number(business.vat_rate ?? 0) : 0}
      />
    </AppShell>
  );
}
