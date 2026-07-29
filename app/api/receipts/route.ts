import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { JOB_DOCUMENTS_BUCKET, ensurePrivateStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobExpenseCategory, ReceiptInboxRecord } from "@/lib/types";
import { canPersistToSupabase } from "@/lib/workflows";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const CATEGORIES: JobExpenseCategory[] = [
  "materials",
  "labour",
  "subcontractor",
  "plant_hire",
  "skip_hire",
  "scaffolding",
  "fuel",
  "waste",
  "other"
];

export async function GET() {
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, receipts: [] });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("receipt_inbox")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

  const result = await supabase
    .from("receipt_inbox")
    .select("*")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false });

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, receipts: result.data ?? [] });
}

export async function POST(request: Request) {
  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, receipt: null, message: "Receipt inbox preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Choose a receipt image or PDF." }, { status: 400 });
  }
  if ((!file.type.startsWith("image/") && file.type !== "application/pdf") || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: "Receipts must be an image or PDF no larger than 15MB." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const businessResult = await supabase.from("businesses").select("id").limit(1).maybeSingle();
  if (businessResult.error || !businessResult.data) {
    return NextResponse.json({ ok: false, error: businessResult.error?.message ?? "Business record not found." }, { status: 500 });
  }

  const bucket = await ensurePrivateStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
  if (!bucket.ok) {
    return NextResponse.json({ ok: false, error: bucket.error }, { status: 500 });
  }

  const receiptId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const storagePath = `receipt-inbox/${businessResult.data.id}/${receiptId}-${safeName}`;
  const mimeType = file.type || "application/octet-stream";
  const upload = await supabase.storage
    .from(JOB_DOCUMENTS_BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: mimeType,
      upsert: false
    });

  if (upload.error) {
    return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 });
  }

  const amount = optionalMoney(formData.get("amount"));
  const vatAmount = money(formData.get("vat_amount"));
  const category = normaliseCategory(formData.get("category"));
  const insert = await supabase
    .from("receipt_inbox")
    .insert({
      id: receiptId,
      business_id: businessResult.data.id,
      display_name: String(formData.get("display_name") || file.name).trim() || file.name,
      storage_bucket: JOB_DOCUMENTS_BUCKET,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: file.size,
      supplier_name: nullableText(formData.get("supplier_name")),
      description: nullableText(formData.get("description")),
      category,
      amount,
      vat_amount: vatAmount,
      expense_date: String(formData.get("expense_date") || new Date().toISOString().slice(0, 10)),
      notes: nullableText(formData.get("notes"))
    })
    .select("*")
    .single();

  if (insert.error || !insert.data) {
    await supabase.storage.from(JOB_DOCUMENTS_BUCKET).remove([storagePath]);
    return NextResponse.json({ ok: false, error: insert.error?.message ?? "Unable to save receipt." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, receipt: insert.data as ReceiptInboxRecord });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const receiptId = String(body.receipt_id ?? "");
  if (!receiptId) {
    return NextResponse.json({ ok: false, error: "receipt_id is required." }, { status: 400 });
  }
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  if (body.action === "assign") {
    return assignReceipt(supabase, receiptId, body);
  }

  const patch = buildEditablePatch(body);
  const result = await supabase
    .from("receipt_inbox")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", receiptId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ ok: false, error: "Pending receipt not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, receipt: result.data as ReceiptInboxRecord });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { receipt_id?: string };
  if (!body.receipt_id) {
    return NextResponse.json({ ok: false, error: "receipt_id is required." }, { status: 400 });
  }
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdminClient();
  const lookup = await supabase
    .from("receipt_inbox")
    .select("id, storage_bucket, storage_path")
    .eq("id", body.receipt_id)
    .eq("status", "pending")
    .maybeSingle();

  if (lookup.error) {
    return NextResponse.json({ ok: false, error: lookup.error.message }, { status: 500 });
  }
  if (!lookup.data) {
    return NextResponse.json({ ok: false, error: "Pending receipt not found." }, { status: 404 });
  }

  const removeFile = await supabase.storage.from(lookup.data.storage_bucket).remove([lookup.data.storage_path]);
  if (removeFile.error) {
    return NextResponse.json({ ok: false, error: removeFile.error.message }, { status: 500 });
  }

  const removeRow = await supabase.from("receipt_inbox").delete().eq("id", body.receipt_id).eq("status", "pending");
  if (removeRow.error) {
    return NextResponse.json({ ok: false, error: removeRow.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function assignReceipt(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  receiptId: string,
  body: Record<string, unknown>
) {
  const jobId = String(body.job_id ?? "");
  const description = String(body.description ?? "").trim();
  const amount = Number(body.amount ?? 0);
  const vatAmount = round2(Math.max(0, Number(body.vat_amount ?? 0)));
  const category = normaliseCategory(body.category);

  if (!jobId || !description || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "Choose a job and enter a description and amount before assigning this receipt." },
      { status: 400 }
    );
  }

  const claim = await supabase
    .from("receipt_inbox")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", receiptId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (claim.error) {
    return NextResponse.json({ ok: false, error: claim.error.message }, { status: 500 });
  }
  if (!claim.data) {
    return NextResponse.json({ ok: false, error: "This receipt is already being assigned or has been filed." }, { status: 409 });
  }

  const receipt = claim.data as ReceiptInboxRecord;
  const jobResult = await supabase
    .from("jobs")
    .select("id, business_id")
    .eq("id", jobId)
    .eq("business_id", receipt.business_id)
    .maybeSingle();
  if (jobResult.error || !jobResult.data) {
    await resetPendingReceipt(supabase, receiptId);
    return NextResponse.json({ ok: false, error: jobResult.error?.message ?? "Job not found." }, { status: 404 });
  }

  const expenseInsert = await supabase
    .from("job_expenses")
    .insert({
      business_id: jobResult.data.business_id,
      job_id: jobId,
      category,
      description,
      supplier_name: nullableText(body.supplier_name),
      amount: round2(amount),
      vat_amount: vatAmount,
      cis_applicable: false,
      cis_rate: 0,
      cis_deduction: 0,
      expense_date: String(body.expense_date || new Date().toISOString().slice(0, 10)),
      notes: nullableText(body.notes)
    })
    .select("*")
    .single();

  if (expenseInsert.error || !expenseInsert.data) {
    await resetPendingReceipt(supabase, receiptId);
    return NextResponse.json({ ok: false, error: expenseInsert.error?.message ?? "Unable to create expense." }, { status: 500 });
  }

  const expenseId = String(expenseInsert.data.id);
  const documentInsert = await supabase
    .from("job_documents")
    .insert({
      job_id: jobId,
      document_type: "expense_receipt",
      display_name: receipt.display_name,
      storage_bucket: receipt.storage_bucket,
      storage_path: receipt.storage_path,
      public_url: null,
      source_type: "uploaded",
      mime_type: receipt.mime_type,
      file_size: receipt.file_size,
      content_html: null
    })
    .select("*")
    .single();

  if (documentInsert.error || !documentInsert.data) {
    await Promise.all([
      supabase.from("job_expenses").delete().eq("id", expenseId),
      resetPendingReceipt(supabase, receiptId)
    ]);
    return NextResponse.json({ ok: false, error: documentInsert.error?.message ?? "Unable to file receipt on job." }, { status: 500 });
  }

  const documentId = String(documentInsert.data.id);
  const link = await supabase.from("job_expense_documents").insert({
    expense_id: expenseId,
    document_id: documentId,
    document_role: "receipt"
  });

  if (link.error) {
    await Promise.all([
      supabase.from("job_documents").delete().eq("id", documentId),
      supabase.from("job_expenses").delete().eq("id", expenseId),
      resetPendingReceipt(supabase, receiptId)
    ]);
    return NextResponse.json({ ok: false, error: link.error.message }, { status: 500 });
  }

  const receiptUrl = `/api/documents/${documentId}`;
  await supabase.from("job_expenses").update({ receipt_url: receiptUrl }).eq("id", expenseId);
  const assigned = await supabase
    .from("receipt_inbox")
    .update({
      status: "assigned",
      assigned_job_id: jobId,
      assigned_expense_id: expenseId,
      assigned_at: new Date().toISOString(),
      supplier_name: nullableText(body.supplier_name),
      description,
      category,
      amount: round2(amount),
      vat_amount: vatAmount,
      expense_date: String(body.expense_date || receipt.expense_date),
      notes: nullableText(body.notes),
      updated_at: new Date().toISOString()
    })
    .eq("id", receiptId)
    .eq("status", "processing");

  if (assigned.error) {
    await Promise.all([
      supabase.from("job_documents").delete().eq("id", documentId),
      supabase.from("job_expenses").delete().eq("id", expenseId),
      resetPendingReceipt(supabase, receiptId)
    ]);
    return NextResponse.json({ ok: false, error: assigned.error.message }, { status: 500 });
  }

  await supabase.from("jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
  return NextResponse.json({
    ok: true,
    expense: { ...expenseInsert.data, receipt_url: receiptUrl, receipt_documents: [documentInsert.data] }
  });
}

function buildEditablePatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if (body.display_name !== undefined) patch.display_name = String(body.display_name || "").trim();
  if (body.supplier_name !== undefined) patch.supplier_name = nullableText(body.supplier_name);
  if (body.description !== undefined) patch.description = nullableText(body.description);
  if (body.category !== undefined) patch.category = normaliseCategory(body.category);
  if (body.amount !== undefined) patch.amount = optionalMoney(body.amount);
  if (body.vat_amount !== undefined) patch.vat_amount = money(body.vat_amount);
  if (body.expense_date !== undefined) patch.expense_date = String(body.expense_date);
  if (body.notes !== undefined) patch.notes = nullableText(body.notes);
  return patch;
}

function normaliseCategory(value: FormDataEntryValue | unknown): JobExpenseCategory {
  const category = String(value || "other") as JobExpenseCategory;
  return CATEGORIES.includes(category) ? category : "other";
}

function nullableText(value: FormDataEntryValue | unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalMoney(value: FormDataEntryValue | unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? round2(amount) : null;
}

function money(value: FormDataEntryValue | unknown) {
  return optionalMoney(value) ?? 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

async function resetPendingReceipt(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  receiptId: string
) {
  await supabase
    .from("receipt_inbox")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("id", receiptId)
    .eq("status", "processing");
}
