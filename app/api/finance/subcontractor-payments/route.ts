import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getBusiness } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateSubcontractorAmounts } from "@/lib/finance/subcontractors";

const PAYMENT_METHODS = new Set(["Bank Transfer", "Card", "Cash", "Cheque", "Other"]);

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subcontractor_payments")
    .select("*, subcontractor:labour_people(*), job:jobs(id,job_ref,job_title)")
    .eq("business_id", business.id)
    .order("work_date", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, payments: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();

  const subcontractorId = text(body.subcontractor_id);
  const jobId = text(body.job_id);
  const description = text(body.description);
  const workDate = isoDate(body.work_date);
  const quantity = money(body.quantity ?? 1);
  const unitRate = money(body.unit_rate);
  const unit = ["hour", "day", "item", "fixed"].includes(text(body.unit)) ? text(body.unit) : "day";
  if (!subcontractorId || !jobId || !description || !workDate || quantity <= 0 || unitRate < 0) {
    return NextResponse.json({ ok: false, error: "Subcontractor, job, work date, description, quantity and rate are required." }, { status: 400 });
  }

  const [workerResult, jobResult] = await Promise.all([
    supabase.from("labour_people").select("*").eq("id", subcontractorId).eq("business_id", business.id).eq("worker_type", "subcontractor").maybeSingle(),
    supabase.from("jobs").select("id,job_ref").eq("id", jobId).eq("business_id", business.id).maybeSingle()
  ]);
  if (workerResult.error || !workerResult.data) return NextResponse.json({ ok: false, error: "Subcontractor not found in this workspace." }, { status: 404 });
  if (jobResult.error || !jobResult.data) return NextResponse.json({ ok: false, error: "Job not found in this workspace." }, { status: 404 });

  const vatRate = workerResult.data.vat_registered ? allowedRate(body.vat_rate, [0, 5, 20], 20) : 0;
  const defaultCis = workerResult.data.cis_status === "net_20" ? 20 : workerResult.data.cis_status === "net_30" ? 30 : 0;
  const cisRate = allowedRate(body.cis_rate, [0, 20, 30], defaultCis);
  const amounts = calculateSubcontractorAmounts({ quantity, unitRate, vatRate: vatRate as 0 | 5 | 20, cisRate: cisRate as 0 | 20 | 30 });
  const { net, vat, gross, cisDeduction, payable } = amounts;
  const confirmed = body.confirmed === true;
  const dueDate = isoDate(body.due_date) || addDays(workDate, Number(workerResult.data.payment_terms_days ?? 7));

  const { data, error } = await supabase
    .from("subcontractor_payments")
    .insert({
      business_id: business.id,
      subcontractor_id: subcontractorId,
      job_id: jobId,
      cost_reference: `WR-SUB-${workDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      work_date: workDate,
      period_end_date: isoDate(body.period_end_date),
      invoice_reference: text(body.invoice_reference) || null,
      description,
      quantity,
      unit,
      unit_rate: unitRate,
      net_amount: net,
      vat_rate: vatRate,
      vat_amount: vat,
      gross_amount: gross,
      cis_rate: cisRate,
      cis_deduction: cisDeduction,
      amount_payable: payable,
      amount_paid: 0,
      amount_outstanding: payable,
      due_date: dueDate,
      status: confirmed ? "Approved" : "Draft",
      notes: text(body.notes) || null,
      created_by: auth.session.user.id,
      approved_by: confirmed ? auth.session.user.id : null,
      approved_at: confirmed ? new Date().toISOString() : null
    })
    .select("*, subcontractor:labour_people(*), job:jobs(id,job_ref,job_title)")
    .single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save subcontractor cost." }, { status: 500 });

  await supabase.from("finance_audit_log").insert({
    business_id: business.id,
    actor_id: auth.session.user.id,
    action: "create_subcontractor_cost",
    entity_type: "subcontractor_payment",
    entity_id: data.id,
    visible_reference: data.invoice_reference,
    details: { job_ref: jobResult.data.job_ref, net_amount: net, vat_amount: vat, cis_deduction: cisDeduction, amount_payable: payable, status: data.status }
  });

  return NextResponse.json({ ok: true, message: confirmed ? "Subcontractor cost approved and added to the job." : "Subcontractor cost saved as a draft.", payment: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const id = text(body.id);
  const action = text(body.action);
  if (!id || !action) return NextResponse.json({ ok: false, error: "Payment id and action are required." }, { status: 400 });

  if (action === "record_payment") {
    if (body.confirmed !== true) return NextResponse.json({ ok: false, error: "Confirm the payment before recording it." }, { status: 400 });
    const amount = money(body.amount);
    const paymentDate = isoDate(body.payment_date);
    const method = text(body.payment_method);
    if (amount <= 0 || !paymentDate || !PAYMENT_METHODS.has(method)) {
      return NextResponse.json({ ok: false, error: "Valid amount, payment date and payment method are required." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("record_subcontractor_payment", {
      p_business_id: business.id,
      p_payment_id: id,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_payment_method: method,
      p_reference: text(body.reference) || null,
      p_actor_id: auth.session.user.id
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Subcontractor payment recorded.", payment: data });
  }

  if (action === "approve" || action === "cancel") {
    if (body.confirmed !== true) return NextResponse.json({ ok: false, error: `Confirm before you ${action} this cost.` }, { status: 400 });
    const status = action === "approve" ? "Approved" : "Cancelled";
    const patch = action === "approve" ? { status, approved_by: auth.session.user.id, approved_at: new Date().toISOString() } : { status };
    const { data, error } = await supabase.from("subcontractor_payments").update(patch).eq("id", id).eq("business_id", business.id).select("*").single();
    if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update subcontractor cost." }, { status: 500 });
    return NextResponse.json({ ok: true, message: `Subcontractor cost ${status.toLowerCase()}.`, payment: data });
  }

  return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
}

function text(value: unknown) { return String(value ?? "").trim(); }
function money(value: unknown) { const number = Number(value); return Number.isFinite(number) ? roundMoney(number) : 0; }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function allowedRate(value: unknown, rates: number[], fallback: number) { const number = Number(value); return rates.includes(number) ? number : fallback; }
function isoDate(value: unknown) { const string = text(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(string)) return null; const parsed = new Date(`${string}T00:00:00Z`); return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== string ? null : string; }
function addDays(date: string, days: number) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + Math.max(0, Math.round(days))); return value.toISOString().slice(0, 10); }
