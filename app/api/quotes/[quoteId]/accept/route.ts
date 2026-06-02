import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePublicQuoteAccess } from "@/lib/public-quote";
import type { CostLineItem, QuoteOption, QuoteRecord } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const body = (await request.json().catch(() => ({}))) as {
    option_id?: string | null;
    selected_line_indexes?: number[];
    customer_name?: string | null;
    customer_email?: string | null;
  };

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (error || !quote) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Quote not found." }, { status: 404 });
  }

  const quoteRecord = quote as QuoteRecord;
  const access = validatePublicQuoteAccess(quoteRecord, token);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Quote link is invalid or has expired." }, { status: 403 });
  }

  const customerName = body.customer_name?.trim() ?? "";
  const customerEmail = body.customer_email?.trim() ?? "";
  if (customerName.length < 2 || !/^\S+@\S+\.\S+$/.test(customerEmail)) {
    return NextResponse.json({ ok: false, error: "Please confirm your name and email before accepting." }, { status: 400 });
  }

  const quoteOptions = (quoteRecord.options ?? []) as QuoteOption[];
  const acceptedOption = quoteOptions.find((option) => option.id === body.option_id) ?? null;
  if (quoteOptions.length > 0 && !acceptedOption) {
    return NextResponse.json({ ok: false, error: "Please choose the quote option you want to accept." }, { status: 400 });
  }

  let acceptedTotal = Number(quoteRecord.total ?? 0);
  const quoteUpdates: Record<string, unknown> = {
    status: "Accepted",
    accepted_option_id: acceptedOption?.id ?? null,
    updated_at: new Date().toISOString()
  };

  if (acceptedOption) {
    const selectedLines = (acceptedOption.cost_breakdown ?? []).map(normaliseCostLine);
    const selectedTotals = calculateTotals(selectedLines);
    quoteUpdates.cost_breakdown = selectedLines;
    quoteUpdates.subtotal = selectedTotals.subtotal;
    quoteUpdates.vat_amount = selectedTotals.vat_amount;
    quoteUpdates.total = selectedTotals.total;
    acceptedTotal = selectedTotals.total;
  } else if (Array.isArray(body.selected_line_indexes) && body.selected_line_indexes.length > 0) {
    const allLines = (quoteRecord.cost_breakdown ?? []) as CostLineItem[];
    const selectedIndexes = new Set(body.selected_line_indexes.filter((index) => Number.isInteger(index) && index >= 0));
    const selectedLines = allLines.filter((_, index) => selectedIndexes.has(index)).map(normaliseCostLine);
    if (!selectedLines.length) {
      return NextResponse.json({ ok: false, error: "Please choose at least one quote section to accept." }, { status: 400 });
    }
    const selectedTotals = calculateTotals(selectedLines);
    quoteUpdates.cost_breakdown = selectedLines;
    quoteUpdates.subtotal = selectedTotals.subtotal;
    quoteUpdates.vat_amount = selectedTotals.vat_amount;
    quoteUpdates.total = selectedTotals.total;
    acceptedTotal = selectedTotals.total;
  }

  const { error: updateError } = await supabase.from("quotes").update(quoteUpdates).eq("id", quoteId);
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await supabase
    .from("jobs")
    .update({ status: "Accepted", accepted_at: new Date().toISOString(), estimated_value: acceptedTotal, updated_at: new Date().toISOString() })
    .eq("id", quoteRecord.job_id);

  return NextResponse.json({ ok: true, accepted_option_id: acceptedOption?.id ?? null });
}

function normaliseCostLine(line: CostLineItem): CostLineItem {
  const quantity = typeof line.quantity === "number" && Number.isFinite(line.quantity) ? line.quantity : undefined;
  const unitRate = typeof line.unit_rate === "number" && Number.isFinite(line.unit_rate) ? line.unit_rate : undefined;
  const cost = quantity != null && unitRate != null ? Math.round(quantity * unitRate * 100) / 100 : Number(line.cost || 0);

  return {
    ...line,
    item: line.item || "Quote item",
    cost,
    vat_applicable: line.vat_applicable !== false,
    notes: line.notes || "",
    quantity,
    unit_rate: unitRate
  };
}

function calculateTotals(lines: CostLineItem[]) {
  const subtotal = Math.round(lines.reduce((sum, line) => sum + Number(line.cost || 0), 0) * 100) / 100;
  const vat_amount = Math.round(lines.filter((line) => line.vat_applicable).reduce((sum, line) => sum + Number(line.cost || 0) * 0.2, 0) * 100) / 100;
  return { subtotal, vat_amount, total: subtotal + vat_amount };
}
