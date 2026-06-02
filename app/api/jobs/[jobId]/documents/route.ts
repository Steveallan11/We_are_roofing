import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { JOB_DOCUMENTS_BUCKET, ensurePrivateStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Document upload preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file");
  const displayName = String(formData.get("display_name") || "").trim();
  const documentType = String(formData.get("document_type") || "customer_upload").trim() || "customer_upload";

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "A file is required." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: "File is too large. Please keep documents under 15MB." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
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

  await supabase.from("jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);

  // Trigger AI analysis for analyzable document types (images and PDFs)
  const ANALYZABLE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
  if (document && ANALYZABLE_TYPES.includes(mimeType)) {
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
