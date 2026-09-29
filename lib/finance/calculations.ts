import { fromPence, percent, toPence } from "@/lib/finance/money";

export type FinancialInvoice = {
  id: string;
  invoice_ref: string;
  tax_point_date?: string | null;
  invoice_date?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  subtotal?: unknown;
  vat_amount?: unknown;
  total?: unknown;
  amount_paid?: unknown;
  balance_due?: unknown;
  customer_name?: string | null;
  job_ref?: string | null;
  job_title?: string | null;
  job_id?: string | null;
};

export type FinancialCredit = { subtotal?: unknown; vat_amount?: unknown; total?: unknown; status?: string | null; job_id?: string | null };
export type FinancialCost = { net_amount?: unknown; amount?: unknown; vat_amount?: unknown; gross_amount?: unknown; category?: string | null; job_id?: string | null };

export function invoiceOutstandingPence(invoice: FinancialInvoice) {
  if (invoice.balance_due !== null && invoice.balance_due !== undefined) return Math.max(0, toPence(invoice.balance_due));
  return Math.max(0, toPence(invoice.total) - toPence(invoice.amount_paid));
}

export function ageingBucket(dueDate: string | null | undefined, asOfDate: string) {
  if (!dueDate) return "Current";
  const due = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`);
  const asOf = Date.parse(`${asOfDate.slice(0, 10)}T00:00:00Z`);
  const days = Math.floor((asOf - due) / 86_400_000);
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30 days overdue";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function summariseSales(invoices: FinancialInvoice[], credits: FinancialCredit[], paymentsPence: number) {
  const active = invoices.filter((row) => !["Draft", "Cancelled", "Void"].includes(String(row.status)));
  const issuedNet = active.reduce((sum, row) => sum + toPence(row.subtotal), 0);
  const outputVat = active.reduce((sum, row) => sum + toPence(row.vat_amount), 0);
  const gross = active.reduce((sum, row) => sum + toPence(row.total), 0);
  const issuedCredits = credits.filter((row) => !["Draft", "Cancelled"].includes(String(row.status)));
  const creditNet = issuedCredits.reduce((sum, row) => sum + toPence(row.subtotal), 0);
  const creditVat = issuedCredits.reduce((sum, row) => sum + toPence(row.vat_amount), 0);
  const creditGross = issuedCredits.reduce((sum, row) => sum + toPence(row.total), 0);
  const outstanding = active.reduce((sum, row) => sum + invoiceOutstandingPence(row), 0) - creditGross;
  return {
    invoice_count: active.length,
    net_sales: fromPence(issuedNet),
    output_vat: fromPence(outputVat),
    gross_sales: fromPence(gross),
    credit_notes: fromPence(creditGross),
    credit_note_net: fromPence(creditNet),
    credit_note_vat: fromPence(creditVat),
    net_adjusted_sales: fromPence(issuedNet - creditNet),
    payments_received: fromPence(paymentsPence),
    outstanding: fromPence(Math.max(0, outstanding))
  };
}

export function calculateProfitability(netRevenuePence: number, directCostsPence: number) {
  const profit = netRevenuePence - directCostsPence;
  return {
    net_revenue: fromPence(netRevenuePence),
    gross_profit: fromPence(profit),
    gross_margin_percent: percent(profit, netRevenuePence)
  };
}

export function normaliseCostCategory(value: string | null | undefined) {
  const category = String(value ?? "other").trim().toLowerCase().replaceAll(" ", "_");
  if (category.includes("material")) return "materials";
  if (category.includes("scaffold")) return "scaffold";
  if (category.includes("subcontract")) return "subcontractors";
  if (category.includes("labour") || category.includes("labor")) return "labour";
  if (category.includes("plant")) return "plant";
  if (category.includes("waste") || category.includes("skip")) return "waste";
  return "other";
}

export function groupDirectCosts(costs: FinancialCost[]) {
  const pence = { materials: 0, scaffold: 0, subcontractors: 0, labour: 0, plant: 0, waste: 0, other: 0 };
  for (const cost of costs) {
    const category = normaliseCostCategory(cost.category) as keyof typeof pence;
    pence[category] += toPence(cost.net_amount ?? cost.amount);
  }
  const total = Object.values(pence).reduce((sum, value) => sum + value, 0);
  return {
    materials: fromPence(pence.materials),
    scaffold: fromPence(pence.scaffold),
    subcontractors: fromPence(pence.subcontractors),
    labour: fromPence(pence.labour),
    plant: fromPence(pence.plant),
    waste: fromPence(pence.waste),
    other: fromPence(pence.other),
    total_direct_costs: fromPence(total),
    total_direct_costs_pence: total
  };
}
