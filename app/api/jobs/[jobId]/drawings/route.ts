import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { JOB_DOCUMENTS_BUCKET, ensurePrivateStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

const MAX_SVG_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = await request.json().catch(() => ({}));
  const svg = typeof body.svg === "string" ? body.svg : "";
  const displayName = String(body.display_name || "Roof drawing").trim();
  const drawingType = String(body.drawing_type || "roof_drawing_svg").trim() || "roof_drawing_svg";

  if (!svg.includes("<svg")) {
    return NextResponse.json({ ok: false, error: "A valid SVG drawing is required." }, { status: 400 });
  }

  const fileSize = Buffer.byteLength(svg, "utf8");
  if (fileSize > MAX_SVG_SIZE) {
    return NextResponse.json({ ok: false, error: "Drawing is too large to save. Download the drawing pack instead." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Generated drawing preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const tableCheck = await supabase.from("job_documents").select("id").limit(1);
  if (tableCheck.error) {
    if (isMissingJobDocumentsTable(tableCheck.error.message)) {
      return NextResponse.json(
        {
          ok: false,
          error: "DOCUMENTS_TABLE_MISSING",
          message: "The job_documents table is missing in Supabase. Run the job documents migration, then retry the drawing save."
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

  const safeName = safeFilename(displayName || drawingType);
  const storagePath = `${jobId}/drawings/${Date.now()}-${safeName}.svg`;

  const upload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(storagePath, Buffer.from(svg, "utf8"), {
    contentType: "image/svg+xml; charset=utf-8",
    upsert: true
  });

  if (upload.error) {
    return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 });
  }

  const { data: document, error } = await supabase
    .from("job_documents")
    .insert({
      job_id: jobId,
      document_type: drawingType,
      display_name: displayName || "Roof Drawing",
      storage_bucket: JOB_DOCUMENTS_BUCKET,
      storage_path: storagePath,
      public_url: null,
      source_type: "generated",
      mime_type: "image/svg+xml",
      file_size: fileSize,
      content_html: null
    })
    .select("*")
    .single();

  if (error || !document) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save drawing metadata." }, { status: 500 });
  }

  await supabase.from("jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);

  return NextResponse.json({ ok: true, message: "Drawing saved to job file.", document });
}

function isMissingJobDocumentsTable(message: string) {
  return /job_documents|schema cache|could not find the table|relation .* does not exist/i.test(message);
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "roof-drawing";
}
