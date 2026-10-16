import { describe, expect, it } from "vitest";
import { getVariationInvoiceProgress } from "@/lib/variations/invoicing";
import type { InvoiceRecord, InvoiceVariationAllocation } from "@/lib/types";

const invoice = (id: string, status: string, total: number, amount_paid = 0): InvoiceRecord => ({
  id,
  business_id: "business-1",
  job_id: "job-1",
  variation_id: null,
  invoice_ref: id,
  status: status as InvoiceRecord["status"],
  issue_date: "2026-10-15",
  due_date: "2026-10-29",
  line_items: [],
  subtotal: total,
  vat_amount: 0,
  total,
  amount_paid,
  balance_due: total - amount_paid
});

describe("variation invoice progress with combined final invoices", () => {
  it("counts combined invoice allocations against approved additional work", () => {
    const invoices = [invoice("final-1", "Draft", 240, 120)];
    const allocations: InvoiceVariationAllocation[] = [{
      id: "allocation-1",
      business_id: "business-1",
      invoice_id: "final-1",
      variation_id: "variation-1",
      amount: 120,
      subtotal: 100,
      vat_amount: 20
    }];

    expect(getVariationInvoiceProgress(invoices, "variation-1", 120, allocations)).toEqual({
      invoiced: 120,
      paid: 60,
      outstanding: 60,
      remaining: 0,
      invoiceCount: 1
    });
  });

  it("ignores allocations attached to a void invoice", () => {
    const invoices = [invoice("final-void", "Void", 120)];
    const allocations: InvoiceVariationAllocation[] = [{
      id: "allocation-void",
      business_id: "business-1",
      invoice_id: "final-void",
      variation_id: "variation-1",
      amount: 120,
      subtotal: 100,
      vat_amount: 20
    }];

    expect(getVariationInvoiceProgress(invoices, "variation-1", 120, allocations).remaining).toBe(120);
  });
});
