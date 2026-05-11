import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStoragePublicUrl, JOB_DOCUMENTS_BUCKET, ensurePublicStorageBucket } from "@/lib/storage";
import { canPersistToSupabase } from "@/lib/workflows";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let recordType = "historical_quote";
  let title = "";
  let content = "";
  let tags: string[] = [];
  let category = "Historical Quote";
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    recordType = String(formData.get("record_type") || "historical_quote");
    title = String(formData.get("title") || "");
    content = String(formData.get("content") || "");
    tags = String(formData.get("tags") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    category = String(formData.get("category") || "Historical Quote");
    const candidate = formData.get("file");
    file = candidate instanceof File ? candidate : null;
  } else {
    const body = (await request.json().catch(() => ({}))) as {
      record_type?: string;
      title?: string;
      content?: string;
      tags?: string[];
      category?: string;
    };
    recordType = body.record_type || "historical_quote";
    title = body.title || "";
    content = body.content || "";
    tags = body.tags ?? [];
    category = body.category || "Historical Quote";
  }

  if (!title.trim()) {
    return NextResponse.json({ ok: false, error: "title is required." }, { status: 400 });
  }

  if (!content.trim() && !file) {
    return NextResponse.json({ ok: false, error: "Either content or a file is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Knowledge upload preview completed." });
  }

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  let filePublicUrl: string | null = null;
  let filePath: string | null = null;

  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    filePath = `knowledge/${Date.now()}-${safeName}`;
    const bucketResult = await ensurePublicStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
    if (!bucketResult.ok) {
      return NextResponse.json({ ok: false, error: bucketResult.error }, { status: 500 });
    }

    const upload = await supabase.storage
      .from(JOB_DOCUMENTS_BUCKET)
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || "application/octet-stream",
        upsert: true
      });

    if (upload.error) {
      return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 });
    }

    filePublicUrl = getStoragePublicUrl(supabase, JOB_DOCUMENTS_BUCKET, filePath);
  }

  if (recordType === "knowledge_base") {
    const { data, error } = await supabase
      .from("knowledge_base")
      .insert({
        business_id: business.id,
        title,
        category,
        content: content || `Uploaded file: ${file?.name ?? "attachment"}`,
        source_type: file ? "upload" : "manual_entry",
        tags
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save knowledge base entry." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Knowledge base entry saved.",
      record: data,
      file_url: filePublicUrl
    });
  }

  const { data, error } = await supabase
    .from("historical_quotes")
    .insert({
      business_id: business.id,
      title,
      source_reference: title,
      source_record_id: crypto.randomUUID(),
      source_url: filePublicUrl,
      source_type: file ? "upload" : "manual_entry",
      source_date: new Date().toISOString().slice(0, 10),
      source_year: new Date().getUTCFullYear(),
      roof_type: tags.find((tag) => ["flat", "pitched", "tile", "slate", "fascia", "chimney"].includes(tag.toLowerCase())) ?? null,
      job_type: null,
      tags,
      imported_text: content || `Uploaded file: ${file?.name ?? "attachment"}`,
      scope_excerpt: content.slice(0, 500) || null,
      materials_excerpt: null,
      original_total: null,
      uplifted_reference_total: null
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save historical quote." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Historical quote example saved.",
    record: data,
    file_url: filePublicUrl
  });
}
