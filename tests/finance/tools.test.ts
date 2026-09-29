import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const tables: Record<string, Row[]> = {};

class Query {
  private rows: Row[];
  private singleResult = false;
  constructor(private table: string) { this.rows = [...(tables[table] ?? [])]; }
  select() { return this; }
  insert(value: Row | Row[]) {
    const values = (Array.isArray(value) ? value : [value]).map((row, index) => ({
      ...row,
      id: row.id ?? `${this.table}-new-${index}`,
      ...(this.table === "invoices" && !row.invoice_ref ? { invoice_ref: "WR-INV-2001" } : {}),
      ...(this.table === "supplier_bills" && !row.bill_number ? { bill_number: "WR-BILL-2001" } : {}),
      ...(this.table === "credit_notes" && !row.credit_note_number ? { credit_note_number: "WR-CN-2001" } : {})
    }));
    (tables[this.table] ??= []).push(...values);
    this.rows = values;
    return this;
  }
  delete() { return this; }
  update(value: Row) { this.rows.forEach((row) => Object.assign(row, value)); return this; }
  eq(field: string, value: unknown) { this.rows = this.rows.filter((row) => row[field] === value); return this; }
  neq(field: string, value: unknown) { this.rows = this.rows.filter((row) => row[field] !== value); return this; }
  gte(field: string, value: unknown) { this.rows = this.rows.filter((row) => String(row[field] ?? "") >= String(value)); return this; }
  lte(field: string, value: unknown) { this.rows = this.rows.filter((row) => String(row[field] ?? "") <= String(value)); return this; }
  ilike(field: string, value: string) { const needle = value.replaceAll("%", "").toLowerCase(); this.rows = this.rows.filter((row) => String(row[field] ?? "").toLowerCase().includes(needle)); return this; }
  in(field: string, values: unknown[]) { this.rows = this.rows.filter((row) => values.includes(row[field])); return this; }
  order() { return this; }
  limit(value: number) { this.rows = this.rows.slice(0, value); return this; }
  maybeSingle() { this.singleResult = true; return this; }
  single() { this.singleResult = true; return this; }
  then(resolve: (result: any) => void) { resolve({ data: this.singleResult ? this.rows[0] ?? null : this.rows, error: null }); }
}

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: (table: string) => new Query(table),
  rpc: (name: string, args: Row) => {
    if (name === "record_customer_payment_finance") {
      const invoice = tables.invoices.find((row) => row.business_id === args.p_business_id && row.invoice_ref === args.p_invoice_ref);
      if (!invoice) return Promise.resolve({ data: null, error: { message: "Invoice not found in this workspace." } });
      if (Number(args.p_amount) > Number(invoice.balance_due)) return Promise.resolve({ data: null, error: { message: "Payment exceeds the invoice outstanding amount." } });
      return Promise.resolve({ data: { invoice_number: invoice.invoice_ref, amount_outstanding: Number(invoice.balance_due) - Number(args.p_amount) }, error: null });
    }
    const bill = tables.supplier_bills.find((row) => row.business_id === args.p_business_id && row.bill_number === args.p_bill_number);
    if (!bill) return Promise.resolve({ data: null, error: { message: "Supplier bill not found in this workspace." } });
    if (Number(args.p_amount) > Number(bill.amount_outstanding)) return Promise.resolve({ data: null, error: { message: "Payment exceeds the supplier bill outstanding amount." } });
    return Promise.resolve({ data: { bill_number: bill.bill_number, amount_outstanding: Number(bill.amount_outstanding) - Number(args.p_amount) }, error: null });
  }
}) }));

import { executeFinanceTool } from "@/lib/finance/service";

const context = { pathname: "/mcp", businessId: A, actorId: "test-user" };

beforeEach(() => {
  Object.assign(tables, {
    jobs: [
      { id: "job-a", business_id: A, job_ref: "WR-J-1005", job_title: "Ladi roof", status: "In Progress", customer_id: "customer-a", estimated_value: "333855.00" },
      { id: "job-zero", business_id: A, job_ref: "WR-J-1006", job_title: "No revenue", status: "In Progress", customer_id: "customer-c", estimated_value: "5000.00" },
      { id: "job-b", business_id: B, job_ref: "WR-J-SECRET", job_title: "Other workspace", status: "Completed", customer_id: "customer-b" }
    ],
    customers: [
      { id: "customer-a", business_id: A, full_name: "Ladi Jadesimi" }, { id: "customer-c", business_id: A, full_name: "Other Customer" },
      { id: "customer-b", business_id: B, full_name: "Private Customer" }
    ],
    suppliers: [{ id: "supplier-a", business_id: A, name: "Roofing Supplies Ltd" }, { id: "supplier-b", business_id: B, name: "Secret Supplier" }],
    invoices: [
      { id: "invoice-a", business_id: A, customer_id: "customer-a", job_id: "job-a", invoice_ref: "WR-INV-1001", invoice_date: "2026-09-01", tax_point_date: "2026-09-01", issue_date: "2026-09-01", due_date: "2026-09-15", status: "Part Paid", currency: "GBP", subtotal: "100000.00", vat_amount: "20000.00", total: "120000.00", amount_paid: "60000.00", balance_due: "60000.00", line_items: [] },
      { id: "invoice-b", business_id: B, customer_id: "customer-b", job_id: "job-b", invoice_ref: "WR-INV-SECRET", invoice_date: "2026-09-01", due_date: "2026-09-15", status: "Issued", subtotal: "999999.00", vat_amount: "0", total: "999999.00", amount_paid: "0", balance_due: "999999.00" }
    ],
    invoice_lines: [
      { id: "line-20", invoice_id: "invoice-a", description: "Roof works", net_amount: "90000.00", vat_code: "20", vat_rate: "20", vat_amount: "18000.00", gross_amount: "108000.00", sort_order: 0 },
      { id: "line-5", invoice_id: "invoice-a", description: "Reduced rate", net_amount: "10000.00", vat_code: "5", vat_rate: "5", vat_amount: "500.00", gross_amount: "10500.00", sort_order: 1 },
      { id: "line-0", invoice_id: "invoice-a", description: "Zero rated", net_amount: "0.00", vat_code: "0", vat_rate: "0", vat_amount: "0.00", gross_amount: "0.00", sort_order: 2 }
    ],
    invoice_payments: [{ id: "pay-a", business_id: A, customer_id: "customer-a", job_id: "job-a", invoice_id: "invoice-a", payment_date: "2026-09-10", paid_at: "2026-09-10T12:00:00Z", amount: "60000.00", payment_method: "Bank Transfer" }],
    credit_notes: [{ id: "credit-a", business_id: A, customer_id: "customer-a", job_id: "job-a", invoice_id: "invoice-a", credit_note_number: "WR-CN-1001", credit_note_date: "2026-09-20", tax_point_date: "2026-09-20", status: "Issued", subtotal: "1000.00", vat_amount: "200.00", total: "1200.00" }],
    supplier_bills: [{ id: "bill-a", business_id: A, supplier_id: "supplier-a", job_id: "job-a", bill_number: "WR-BILL-1001", bill_date: "2026-09-02", tax_point_date: "2026-09-02", due_date: "2026-09-20", status: "Part Paid", subtotal: "32000.00", vat_amount: "6400.00", total: "38400.00", amount_paid: "10000.00", amount_outstanding: "28400.00", expense_category: "Materials" }],
    supplier_payments: [{ id: "sp-a", business_id: A, supplier_id: "supplier-a", job_id: "job-a", supplier_bill_id: "bill-a", payment_date: "2026-09-15", amount: "10000.00" }],
    job_expenses: [
      { id: "e1", business_id: A, job_id: "job-a", category: "Scaffolding", description: "Scaffold", net_amount: "18000", amount: "18000", vat_amount: "3600", gross_amount: "21600", expense_date: "2026-09-03" },
      { id: "e2", business_id: A, job_id: "job-a", category: "Subcontractor", description: "Subcontractor", net_amount: "12000", amount: "12000", vat_amount: "0", gross_amount: "12000", expense_date: "2026-09-04" },
      { id: "e3", business_id: A, job_id: "job-a", category: "Labour", description: "Labour", net_amount: "15000", amount: "15000", vat_amount: "0", gross_amount: "15000", expense_date: "2026-09-05" },
      { id: "e4", business_id: A, job_id: "job-a", category: "Plant Hire", description: "Plant", net_amount: "3000", amount: "3000", vat_amount: "600", gross_amount: "3600", expense_date: "2026-09-06" },
      { id: "e5", business_id: A, job_id: "job-a", category: "Waste", description: "Waste", net_amount: "1500", amount: "1500", vat_amount: "300", gross_amount: "1800", expense_date: "2026-09-07" },
      { id: "e6", business_id: A, job_id: "job-a", category: "Other", description: "Other", net_amount: "2500", amount: "2500", vat_amount: "500", gross_amount: "3000", expense_date: "2026-09-08" },
      { id: "e7", business_id: A, job_id: "job-zero", category: "Materials", description: "Cost without revenue", net_amount: "1000", amount: "1000", vat_amount: "200", gross_amount: "1200", expense_date: "2026-09-09" }
    ],
    quotes: [{ id: "quote-a", business_id: A, job_id: "job-a", status: "Accepted", total: "333855.00", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" }],
    job_variations: [{ id: "variation-a", business_id: A, job_id: "job-a", variation_ref: "WR-J-1005-V01", title: "Additional leadwork", status: "Accepted", subtotal: "5000.00", vat_amount: "1000.00", total: "6000.00" }],
    credit_note_lines: [],
    supplier_bill_lines: []
  });
});

describe("all finance reporting tools", () => {
  const successfulCalls: Array<[string, Row]> = [
    ["get_invoices", { start_date: "2026-09-01", end_date: "2026-09-30" }],
    ["get_invoice_detail", { invoice_number: "WR-INV-1001" }],
    ["get_payments", { start_date: "2026-09-01", end_date: "2026-09-30" }],
    ["get_supplier_bills", { unpaid_only: true }],
    ["get_expenses", { start_date: "2026-09-01", end_date: "2026-09-30" }],
    ["get_job_financials", { job_ref: "WR-J-1005" }],
    ["get_sales_summary", { start_date: "2026-09-01", end_date: "2026-09-30", group_by: "month" }],
    ["get_vat_summary", { start_date: "2026-09-01", end_date: "2026-09-30" }],
    ["get_outstanding_debtors", { as_of_date: "2026-09-23" }],
    ["get_outstanding_creditors", { as_of_date: "2026-09-23" }],
    ["get_profitability_report", { include_open_jobs: true }],
    ["get_financial_summary", { start_date: "2026-09-01", end_date: "2026-09-30" }],
    ["get_accountant_pack", { start_date: "2026-09-01", end_date: "2026-09-30" }]
  ];

  it.each(successfulCalls)("%s returns a structured successful response", async (tool, input) => {
    const result = await executeFinanceTool(tool, input, context);
    expect(result.ok).toBe(true);
    expect(result.summary).toBeTruthy();
    expect(result.data).toBeTruthy();
  });

  it("enforces business isolation even when another workspace has valid identifiers", async () => {
    const invoices = await executeFinanceTool("get_invoices", {}, context);
    expect(JSON.stringify(invoices.data)).not.toContain("WR-INV-SECRET");
    await expect(executeFinanceTool("get_job_financials", { job_ref: "WR-J-SECRET" }, context)).rejects.toThrow("not found in this workspace");
  });

  it("returns empty results without inventing totals", async () => {
    const result = await executeFinanceTool("get_invoices", { start_date: "2025-01-01", end_date: "2025-01-31" }, context);
    expect(result.summary).toContain("No invoices");
    expect((result.data as Row).totals.gross).toBe(0);
  });

  it("reports partial payment, overdue debt, credit notes and VAT correctly", async () => {
    const debt = await executeFinanceTool("get_outstanding_debtors", { as_of_date: "2026-09-23" }, context);
    expect((debt.data as Row).total_outstanding).toBe(58800);
    expect((debt.data as Row).items[0].ageing_bucket).toBe("1-30 days overdue");
    const vat = await executeFinanceTool("get_vat_summary", { start_date: "2026-09-01", end_date: "2026-09-30" }, context);
    expect((vat.data as Row).credit_note_adjustments.vat).toBe(200);
    expect((vat.data as Row).input_vat).toBe(11600);
    expect((vat.data as Row).vat_payable).toBe(8200);
  });

  it("calculates the Ladi job fixture profitability and zero-revenue job", async () => {
    const ladi = await executeFinanceTool("get_job_financials", { job_ref: "WR-J-1005" }, context);
    expect((ladi.data as Row).costs.total_direct_costs).toBe(84000);
    expect((ladi.data as Row).profitability.gross_profit).toBe(15000);
    const zero = await executeFinanceTool("get_job_financials", { job_ref: "WR-J-1006" }, context);
    expect((zero.data as Row).profitability.gross_margin_percent).toBe(0);
    expect((zero.data as Row).profitability.gross_profit).toBe(-1000);
  });

  it("rejects incorrect IDs, invalid ranges and missing workspace context", async () => {
    await expect(executeFinanceTool("get_invoice_detail", { invoice_id: "missing" }, context)).rejects.toThrow("not found");
    await expect(executeFinanceTool("get_sales_summary", { start_date: "2026-10-01", end_date: "2026-09-01" }, context)).rejects.toThrow("on or before");
    await expect(executeFinanceTool("get_invoices", {}, { pathname: "/mcp" })).rejects.toThrow("authenticated workspace");
  });

  it("caps result limits at 100", async () => {
    tables.invoices = Array.from({ length: 120 }, (_, index) => ({ ...tables.invoices[0], id: `invoice-${index}`, invoice_ref: `WR-INV-${index}` }));
    const result = await executeFinanceTool("get_invoices", { limit: 999 }, context);
    expect((result.data as Row).invoices).toHaveLength(100);
  });

  it("requires explicit confirmation for every finance write tool", async () => {
    for (const tool of ["create_invoice", "record_customer_payment", "create_supplier_bill", "record_supplier_payment", "create_expense", "create_credit_note"]) {
      await expect(executeFinanceTool(tool, {}, context)).rejects.toThrow("confirmed must be true");
    }
  });

  it("creates invoice, supplier bill, expense and credit note with reviewed VAT lines", async () => {
    const invoice = await executeFinanceTool("create_invoice", { job_ref: "WR-J-1005", invoice_date: "2026-09-23", due_date: "2026-10-23", status: "Draft", lines: [{ description: "Works", quantity: 1, unit_price: 100, vat_code: "20" }], confirmed: true }, context);
    expect(invoice.ok).toBe(true);
    expect((invoice.data as Row).total).toBe(120);
    expect(tables.invoice_lines.at(-1)).not.toHaveProperty("expense_category");
    expect(tables.invoice_lines.at(-1)).toMatchObject({ description: "Works", category: null, net_amount: 100, vat_amount: 20, gross_amount: 120 });
    const bill = await executeFinanceTool("create_supplier_bill", { supplier_name: "Roofing Supplies Ltd", job_ref: "WR-J-1005", bill_date: "2026-09-23", lines: [{ description: "Materials", quantity: 2, unit_cost: 50, vat_code: "5" }], confirmed: true }, context);
    expect((bill.data as Row).total).toBe(105);
    expect(tables.supplier_bill_lines.at(-1)).not.toHaveProperty("category");
    expect(tables.supplier_bill_lines.at(-1)).toHaveProperty("expense_category", null);
    const expense = await executeFinanceTool("create_expense", { expense_date: "2026-09-23", description: "Parking", category: "Vehicle", net_amount: 10, vat_code: "0", confirmed: true }, context);
    expect((expense.data as Row).gross_amount).toBe(10);
    const credit = await executeFinanceTool("create_credit_note", { invoice_number: "WR-INV-1001", credit_note_date: "2026-09-23", reason: "Adjustment", lines: [{ description: "Adjustment", quantity: 1, unit_price: 10, vat_code: "20" }], confirmed: true }, context);
    expect((credit.data as Row).total).toBe(12);
  });

  it("records part payments and rejects customer and supplier overpayments", async () => {
    const customer = await executeFinanceTool("record_customer_payment", { invoice_number: "WR-INV-1001", amount: 1000, payment_date: "2026-09-23", payment_method: "Bank Transfer", confirmed: true }, context);
    expect((customer.data as Row).amount_outstanding).toBe(59000);
    await expect(executeFinanceTool("record_customer_payment", { invoice_number: "WR-INV-1001", amount: 70000, payment_date: "2026-09-23", payment_method: "Bank Transfer", confirmed: true }, context)).rejects.toThrow("exceeds");
    const supplier = await executeFinanceTool("record_supplier_payment", { bill_number: "WR-BILL-1001", amount: 1000, payment_date: "2026-09-23", payment_method: "Bank Transfer", confirmed: true }, context);
    expect((supplier.data as Row).amount_outstanding).toBe(27400);
    await expect(executeFinanceTool("record_supplier_payment", { bill_number: "WR-BILL-1001", amount: 30000, payment_date: "2026-09-23", payment_method: "Bank Transfer", confirmed: true }, context)).rejects.toThrow("exceeds");
  });

  it("links an invoice to approved additional work and rejects amounts over its remaining balance", async () => {
    const invoice = await executeFinanceTool("create_invoice", {
      job_ref: "WR-J-1005",
      additional_work_ref: "WR-J-1005-V01",
      invoice_date: "2026-09-24",
      due_date: "2026-09-24",
      status: "Draft",
      lines: [{ description: "Additional leadwork", quantity: 1, unit_price: 5000, vat_code: "20" }],
      confirmed: true
    }, context);
    expect(invoice.ok).toBe(true);
    expect(tables.invoices.at(-1)).toMatchObject({ variation_id: "variation-a", total: 6000 });
    await expect(executeFinanceTool("create_invoice", {
      job_ref: "WR-J-1005",
      additional_work_ref: "WR-J-1005-V01",
      invoice_date: "2026-09-24",
      due_date: "2026-09-24",
      status: "Draft",
      lines: [{ description: "Too much", quantity: 1, unit_price: 1, vat_code: "20" }],
      confirmed: true
    }, context)).rejects.toThrow("remaining");
  });
});
