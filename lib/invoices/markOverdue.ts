import type { SupabaseClient } from "@supabase/supabase-js";
import { createActivity } from "@/lib/activity/createActivity";

type OverdueInvoice = {
  id: string;
  business_id: string;
  job_id: string;
  invoice_ref: string;
  due_date: string;
  balance_due: number;
};

export async function markOverdueInvoices(supabase: SupabaseClient) {
  const today = getLondonDate();
  const lookup = await supabase
    .from("invoices")
    .select("id, business_id, job_id, invoice_ref, due_date, balance_due")
    .in("status", ["Sent", "Part Paid"])
    .lt("due_date", today)
    .gt("balance_due", 0);

  if (lookup.error) throw new Error(lookup.error.message);

  const candidates = (lookup.data ?? []) as OverdueInvoice[];
  if (candidates.length === 0) {
    return { checkedAt: new Date().toISOString(), overdueCount: 0, invoices: [] as OverdueInvoice[] };
  }

  const update = await supabase
    .from("invoices")
    .update({ status: "Overdue", updated_at: new Date().toISOString() })
    .in(
      "id",
      candidates.map((invoice) => invoice.id)
    )
    .in("status", ["Sent", "Part Paid"])
    .lt("due_date", today)
    .gt("balance_due", 0)
    .select("id");

  if (update.error) throw new Error(update.error.message);

  const updatedIds = new Set((update.data ?? []).map((invoice) => String(invoice.id)));
  const updatedInvoices = candidates.filter((invoice) => updatedIds.has(invoice.id));

  await Promise.all(
    updatedInvoices.map((invoice) =>
      createActivity(supabase, {
        business_id: invoice.business_id,
        job_id: invoice.job_id,
        invoice_id: invoice.id,
        activity_type: "invoice_overdue",
        message: `${invoice.invoice_ref} became overdue`,
        details: {
          due_date: invoice.due_date,
          balance_due: Number(invoice.balance_due ?? 0)
        },
        actor_type: "system",
        linked_entity_type: "invoice",
        linked_entity_id: invoice.id
      })
    )
  );

  return {
    checkedAt: new Date().toISOString(),
    overdueCount: updatedInvoices.length,
    invoices: updatedInvoices
  };
}

function getLondonDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
