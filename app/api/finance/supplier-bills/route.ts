import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getBusiness } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("supplier_bills").select("*, supplier:suppliers(*), job:jobs(id,job_ref,job_title)").eq("business_id", business.id).order("bill_date", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bills: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const supplierId = String(body.supplier_id || "").trim();
  const jobId = String(body.job_id || "").trim() || null;
  const billDate = validDate(body.bill_date);
  const dueDate = validDate(body.due_date);
  const net = cash(body.net_amount);
  const vatRate = [0, 5, 20].includes(Number(body.vat_rate)) ? Number(body.vat_rate) : 0;
  const vat = cash(net * vatRate / 100);
  if (!supplierId || !billDate || net < 0 || vat < 0) return NextResponse.json({ ok: false, error: "Supplier, bill date and valid amounts are required." }, { status: 400 });
  const [supplierResult, jobResult] = await Promise.all([
    supabase.from("suppliers").select("id,name").eq("id", supplierId).eq("business_id", business.id).maybeSingle(),
    jobId ? supabase.from("jobs").select("id,job_ref").eq("id", jobId).eq("business_id", business.id).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);
  if (!supplierResult.data || supplierResult.error) return NextResponse.json({ ok: false, error: "Supplier not found in this workspace." }, { status: 404 });
  if (jobId && (!jobResult.data || jobResult.error)) return NextResponse.json({ ok: false, error: "Job not found in this workspace." }, { status: 404 });
  const total = Math.round((net + vat) * 100) / 100;
  const { data, error } = await supabase.from("supplier_bills").insert({
    business_id: business.id,
    supplier_id: supplierId,
    job_id: jobId,
    bill_number: String(body.bill_number || "").trim() || null,
    supplier_reference: String(body.supplier_reference || "").trim() || null,
    bill_date: billDate,
    tax_point_date: validDate(body.tax_point_date) || billDate,
    due_date: dueDate,
    status: "Received",
    subtotal: net,
    vat_amount: vat,
    total,
    amount_paid: 0,
    amount_outstanding: total,
    expense_category: String(body.expense_category || "Other").trim(),
    notes: String(body.notes || "").trim() || null
  }).select("*, supplier:suppliers(*), job:jobs(id,job_ref,job_title)").single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save supplier bill." }, { status: 500 });
  await supabase.from("supplier_bill_lines").insert({ supplier_bill_id: data.id, description: String(body.description || data.expense_category || "Supplier bill"), quantity: 1, unit: "item", unit_cost: net, net_amount: net, vat_rate: vatRate, vat_code: String(vatRate), vat_amount: vat, gross_amount: total, expense_category: data.expense_category });
  return NextResponse.json({ ok: true, message: "Supplier bill added.", bill: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.confirmed !== true) return NextResponse.json({ ok: false, error: "Confirm the supplier payment before recording it." }, { status: 400 });
  const business = await getBusiness();
  const amount = cash(body.amount);
  const date = validDate(body.payment_date);
  if (!String(body.bill_number || "").trim() || amount <= 0 || !date) return NextResponse.json({ ok: false, error: "Bill number, amount and payment date are required." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().rpc("record_supplier_payment_finance", { p_business_id: business.id, p_bill_number: String(body.bill_number).trim(), p_amount: amount, p_payment_date: date, p_payment_method: String(body.payment_method || "Bank Transfer"), p_reference: String(body.reference || "").trim() || null, p_notes: String(body.notes || "").trim() || null, p_actor_id: auth.session.user.id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: "Supplier payment recorded.", payment: data });
}

function cash(value: unknown) { const number = Number(value); return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0; }
function validDate(value: unknown) { const date = String(value || "").trim(); return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null; }
