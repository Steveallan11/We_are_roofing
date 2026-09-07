import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceRecord, JobVariationRecord } from "@/lib/types";

export type VariationInvoiceProgress = {
  invoiced: number;
  paid: number;
  outstanding: number;
  remaining: number;
  invoiceCount: number;
};

export function getVariationInvoiceProgress(
  invoices: InvoiceRecord[],
  variationId: string,
  approvedTotal: number
): VariationInvoiceProgress {
  const liveInvoices = invoices.filter(
    (invoice) => invoice.variation_id === variationId && invoice.status !== "Void"
  );
  const invoiced = roundMoney(liveInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0));
  const paid = roundMoney(liveInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0));

  return {
    invoiced,
    paid,
    outstanding: roundMoney(Math.max(0, invoiced - paid)),
    remaining: roundMoney(Math.max(0, Number(approvedTotal) - invoiced)),
    invoiceCount: liveInvoices.length
  };
}

export async function updateVariationInvoiceStatus(supabase: SupabaseClient, variationId: string) {
  const [variationResult, invoicesResult] = await Promise.all([
    supabase.from("job_variations").select("id,total,status").eq("id", variationId).single(),
    supabase
      .from("invoices")
      .select("variation_id,status,total,amount_paid")
      .eq("variation_id", variationId)
      .neq("status", "Void")
  ]);

  if (variationResult.error || !variationResult.data || invoicesResult.error) return;
  const variation = variationResult.data as Pick<JobVariationRecord, "id" | "total" | "status">;
  if (["Draft", "Sent", "Declined", "Void"].includes(variation.status)) return;

  const progress = getVariationInvoiceProgress(
    (invoicesResult.data as InvoiceRecord[] | null) ?? [],
    variation.id,
    Number(variation.total ?? 0)
  );
  const fullyInvoiced = progress.remaining <= 0.01;
  const fullyPaid = fullyInvoiced && progress.paid >= Number(variation.total ?? 0) - 0.01;
  const nextStatus: JobVariationRecord["status"] = fullyPaid
    ? "Paid"
    : progress.invoiceCount > 0
      ? "Invoiced"
      : "Accepted";

  if (variation.status === nextStatus) return;
  await supabase
    .from("job_variations")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", variation.id);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
