import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const contentType = request.headers.get("content-type") ?? "";

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      jobId,
      message: "Photo upload preview completed.",
      next_status: "Ready For AI Quote"
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("id")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let storagePath = `${jobId}/${Date.now()}-placeholder.txt`;
  let caption: string | null = null;
  let photoType = "General";
  let publicUrl: string | null = null;
  let fileSize: number | null = null;
  let mimeType: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    caption = String(formData.get("caption") || "") || null;
    photoType = String(formData.get("photo_type") || "General");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "A file is required for multipart upload." }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    storagePath = `${jobId}/${Date.now()}-${safeName}`;
    fileSize = file.size;
    mimeType = file.type || null;

    const upload = await supabase.storage
      .from("job-photos")
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: mimeType ?? "application/octet-stream",
        upsert: true
      });

    if (upload.error) {
      return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 });
    }

    publicUrl = supabase.storage.from("job-photos").getPublicUrl(storagePath).data.publicUrl;
  } else {
    const body = (await request.json().catch(() => ({}))) as {
      photo_type?: string;
      caption?: string;
      file_name?: string;
      public_url?: string | null;
    };

    if (!body.file_name) {
      return NextResponse.json({ ok: false, error: "file_name is required." }, { status: 400 });
    }

    caption = body.caption ?? null;
    photoType = body.photo_type || "General";
    storagePath = `${jobId}/${Date.now()}-${body.file_name}`;
    publicUrl = body.public_url ?? null;
  }

  const { data: photo, error } = await supabase
    .from("job_photos")
    .insert({
      job_id: jobId,
      survey_id: survey?.id ?? null,
      storage_path: storagePath,
      public_url: publicUrl,
      photo_type: photoType,
      caption,
      file_size: fileSize,
      mime_type: mimeType
    })
    .select("*")
    .single();

  if (error || !photo) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to save photo metadata." }, { status: 500 });
  }

  await supabase
    .from("jobs")
    .update({
      status: "Ready For AI Quote",
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  return NextResponse.json({
    ok: true,
    jobId,
    message: "Photo saved to Supabase.",
    next_status: "Ready For AI Quote",
    storage_path: storagePath,
    photo
  });
}

export async function GET(_request: Request, { params }: Props) {
  const { jobId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, data: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("job_photos")
    .select("*")
    .eq("job_id", jobId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
