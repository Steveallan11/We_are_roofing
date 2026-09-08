import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { JOB_DOCUMENTS_BUCKET, ensurePrivateStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const DIRECT_UPLOAD_DOCUMENT_TYPES = new Set([
  "expense_receipt",
  "customer_upload",
  "supplier_quote",
  "building_control",
  "insurance_document",
  "warranty_document",
  "site_document",
  "quote_attachment"
]);

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Document upload preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: string;
      quote_id?: string;
      file_name?: string;
      file_size?: number;
      content_type?: string;
      document_type?: string;
      display_name?: string;
      storage_path?: string;
    };
    const quoteId = String(body.quote_id || "").trim();
    const requestedDocumentType = String(body.document_type || (quoteId ? "quote_attachment" : "customer_upload")).trim();
    const documentType = DIRECT_UPLOAD_DOCUMENT_TYPES.has(requestedDocumentType) ? requestedDocumentType : "customer_upload";
    if (quoteId) {
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("id")
        .eq("id", quoteId)
        .eq("job_id", jobId)
        .maybeSingle();
      if (quoteError) {
        return NextResponse.json({ ok: false, error: quoteError.message }, { status: 500 });
      }
      if (!quote) {
        return NextResponse.json({ ok: false, error: "Quote not found on this job." }, { status: 404 });
      }
    }

    if (body.mode === "create-upload") {
      const fileName = String(body.file_name || "").trim();
      const fileSize = Number(body.file_size || 0);
      if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
        return NextResponse.json({ ok: false, error: "File name and size are required." }, { status: 400 });
      }
      if (fileSize > MAX_FILE_SIZE) {
        return NextResponse.json({ ok: false, error: "File is too large. Please keep quote attachments under 25 MB." }, { status: 400 });
      }

      const bucket = await ensurePrivateStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
      if (!bucket.ok) {
        return NextResponse.json({ ok: false, error: bucket.error }, { status: 500 });
      }

      const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `${jobId}/uploads/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const signedUpload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).createSignedUploadUrl(storagePath);
      if (signedUpload.error || !signedUpload.data) {
        return NextResponse.json({ ok: false, error: signedUpload.error?.message ?? "Unable to prepare the document upload." }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        storage_path: signedUpload.data.path,
        token: signedUpload.data.token
      });
    }

    if (body.mode === "complete-upload") {
      const storagePath = String(body.storage_path || "").trim();
      if (!storagePath || !storagePath.startsWith(`${jobId}/uploads/`)) {
        return NextResponse.json({ ok: false, error: "The uploaded document path is invalid." }, { status: 400 });
      }

      const fileInfo = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).info(storagePath);
      if (fileInfo.error || !fileInfo.data) {
        return NextResponse.json({ ok: false, error: fileInfo.error?.message ?? "The uploaded document could not be verified." }, { status: 400 });
      }
      const fileSize = Number(fileInfo.data.size || 0);
      if (!fileSize || fileSize > MAX_FILE_SIZE) {
        await supabase.storage.from(JOB_DOCUMENTS_BUCKET).remove([storagePath]);
        return NextResponse.json({ ok: false, error: "The uploaded file is empty or larger than 25 MB." }, { status: 400 });
      }

      const fallbackName = storagePath.split("/").at(-1)?.replace(/^\d+-[0-9a-f-]+-/, "") || "Quote attachment";
      const { data: document, error: documentError } = await supabase
        .from("job_documents")
        .insert({
          job_id: jobId,
          quote_id: quoteId || null,
          document_type: documentType,
          display_name: String(body.display_name || "").trim() || fallbackName,
          storage_bucket: JOB_DOCUMENTS_BUCKET,
          storage_path: storagePath,
          public_url: null,
          source_type: "uploaded",
          mime_type: fileInfo.data.contentType || "application/octet-stream",
          file_size: fileSize,
          content_html: null
        })
        .select("*")
        .single();
      if (documentError || !document) {
        await supabase.storage.from(JOB_DOCUMENTS_BUCKET).remove([storagePath]);
        return NextResponse.json({ ok: false, error: documentError?.message ?? "Unable to save document metadata." }, { status: 500 });
      }

      await supabase.from("jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
      return NextResponse.json({ ok: true, message: quoteId ? "Document saved to this quote." : "Document saved to this job.", document });
    }

    return NextResponse.json({ ok: false, error: "Unsupported document upload mode." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const displayName = String(formData.get("display_name") || "").trim();
  const expenseId = String(formData.get("expense_id") || "").trim();
  const quoteId = String(formData.get("quote_id") || "").trim();
  const requestedDocumentType = String(formData.get("document_type") || "customer_upload").trim() || "customer_upload";
  const documentType = expenseId ? "expense_receipt" : requestedDocumentType;

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "A file is required." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: "File is too large. Please keep documents under 25 MB." }, { status: 400 });
  }

  if (quoteId) {
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id")
      .eq("id", quoteId)
      .eq("job_id", jobId)
      .maybeSingle();

    if (quoteError) {
      return NextResponse.json({ ok: false, error: quoteError.message }, { status: 500 });
    }
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Quote not found on this job." }, { status: 404 });
    }
  }

  if (expenseId) {
    const { data: expense, error: expenseError } = await supabase
      .from("job_expenses")
      .select("id")
      .eq("id", expenseId)
      .eq("job_id", jobId)
      .maybeSingle();

    if (expenseError) {
      return NextResponse.json({ ok: false, error: expenseError.message }, { status: 500 });
    }
    if (!expense) {
      return NextResponse.json({ ok: false, error: "Expense not found on this job." }, { status: 404 });
    }
  }

  const tableCheck = await supabase.from("job_documents").select("id").limit(1);
  if (tableCheck.error) {
    if (isMissingJobDocumentsTable(tableCheck.error.message)) {
      return NextResponse.json(
        {
          ok: false,
          error: "DOCUMENTS_TABLE_MISSING",
          message: "The job_documents table is missing in Supabase. Run migration 0021_repair_phase0_core_tables.sql, then retry the upload."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: false, error: tableCheck.error.message }, { status: 500 });
  }

  const bucket = await ensurePrivateStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
  if (!bucket.ok) {
    return NextResponse.json({ ok: false, error: bucket.error }, { status: 500 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const storagePath = `${jobId}/uploads/${Date.now()}-${safeName}`;
  const mimeType = file.type || "application/octet-stream";

  const upload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(storagePath, Buffer.from(await file.arrayBuffer()), {
    contentType: mimeType,
    upsert: true
  });

  if (upload.error) {
    return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 });
  }

  const { data: document, error } = await supabase
    .from("job_documents")
    .insert({
      job_id: jobId,
      quote_id: quoteId || null,
      document_type: documentType,
      display_name: displayName || file.name,
      storage_bucket: JOB_DOCUMENTS_BUCKET,
      storage_path: storagePath,
      public_url: null,
      source_type: "uploaded",
      mime_type: mimeType,
      file_size: file.size,
      content_html: null
    })
    .select("*")
    .single();

  if (error || !document) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save document metadata." }, { status: 500 });
  }

  if (expenseId) {
    const { error: linkError } = await supabase.from("job_expense_documents").insert({
      expense_id: expenseId,
      document_id: document.id,
      document_role: "receipt"
    });

    if (linkError) {
      await Promise.all([
        supabase.storage.from(JOB_DOCUMENTS_BUCKET).remove([storagePath]),
        supabase.from("job_documents").delete().eq("id", document.id)
      ]);
      return NextResponse.json(
        {
          ok: false,
          error: "Receipt could not be linked to the expense. Run migration 0036_expense_receipt_documents.sql and retry."
        },
        { status: 500 }
      );
    }

    await supabase
      .from("job_expenses")
      .update({ receipt_url: `/api/documents/${document.id}`, updated_at: new Date().toISOString() })
      .eq("id", expenseId)
      .is("receipt_url", null);
  }

  await supabase.from("jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);

  // Trigger AI analysis for analyzable document types (images and PDFs)
  const ANALYZABLE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
  if (document && documentType !== "quote_attachment" && ANALYZABLE_TYPES.includes(mimeType)) {
    // Non-blocking: trigger analysis in background
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/jobs/${jobId}/documents/${document.id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }).catch((err) => console.error("Background analysis failed:", err));
  }

  return NextResponse.json({ ok: true, message: "Document saved to job file.", document });
}

function isMissingJobDocumentsTable(message: string) {
  return /job_documents|schema cache|could not find the table|relation .* does not exist/i.test(message);
}
