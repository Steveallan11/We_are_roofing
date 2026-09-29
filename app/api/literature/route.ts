import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getBusiness, getLiteratureAssets } from "@/lib/data";
import { JOB_DOCUMENTS_BUCKET, ensurePrivateStorageBucket } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ ok: true, literature: await getLiteratureAssets() });
}

export async function POST(request: Request) {
  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, message: "Literature upload preview completed." });
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    mode?: string;
    file_name?: string;
    file_size?: number;
    content_type?: string;
    display_name?: string;
    description?: string;
    storage_path?: string;
  };
  const supabase = createSupabaseAdminClient();

  if (body.mode === "create-upload") {
    const fileName = String(body.file_name || "").trim();
    const fileSize = Number(body.file_size || 0);
    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ ok: false, error: "File name and size are required." }, { status: 400 });
    }
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: "Please keep each brochure under 25 MB." }, { status: 400 });
    }
    const bucket = await ensurePrivateStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
    if (!bucket.ok) return NextResponse.json({ ok: false, error: bucket.error }, { status: 500 });
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const storagePath = `literature/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const signedUpload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).createSignedUploadUrl(storagePath);
    if (signedUpload.error || !signedUpload.data) {
      return NextResponse.json({ ok: false, error: signedUpload.error?.message ?? "Could not prepare the upload." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, storage_path: signedUpload.data.path, token: signedUpload.data.token });
  }

  if (body.mode === "complete-upload") {
    const storagePath = String(body.storage_path || "").trim();
    if (!storagePath.startsWith("literature/")) {
      return NextResponse.json({ ok: false, error: "The uploaded file path is invalid." }, { status: 400 });
    }
    const fileInfo = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).info(storagePath);
    if (fileInfo.error || !fileInfo.data) {
      return NextResponse.json({ ok: false, error: fileInfo.error?.message ?? "The upload could not be verified." }, { status: 400 });
    }
    const business = await getBusiness();
    const fallbackName = storagePath.split("/").at(-1)?.replace(/^\d+-[0-9a-f-]+-/, "") || "Customer brochure";
    const { data, error } = await supabase
      .from("literature_assets")
      .insert({
        business_id: business.id,
        display_name: String(body.display_name || "").trim() || fallbackName,
        description: String(body.description || "").trim() || null,
        storage_bucket: JOB_DOCUMENTS_BUCKET,
        storage_path: storagePath,
        mime_type: fileInfo.data.contentType || "application/octet-stream",
        file_size: Number(fileInfo.data.size || 0),
        is_active: true
      })
      .select("*")
      .single();
    if (error || !data) {
      await supabase.storage.from(JOB_DOCUMENTS_BUCKET).remove([storagePath]);
      return NextResponse.json({ ok: false, error: error?.message ?? "Could not save this brochure." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, literature: data });
  }

  return NextResponse.json({ ok: false, error: "Unsupported upload mode." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ ok: false, error: "Literature ID is required." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("literature_assets").select("storage_bucket, storage_path").eq("id", body.id).single();
  const { error } = await supabase.from("literature_assets").delete().eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (data?.storage_path) await supabase.storage.from(data.storage_bucket || JOB_DOCUMENTS_BUCKET).remove([data.storage_path]);
  return NextResponse.json({ ok: true });
}
