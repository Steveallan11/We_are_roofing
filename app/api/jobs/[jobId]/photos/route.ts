import { NextResponse } from "next/server";
import { photoMetadataSchema } from "@/lib/validators";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = await request.json();
  const parsed = photoMetadataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const storagePath = `${jobId}/${Date.now()}-${parsed.data.file_name}`;

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      jobId,
      message: "Photo metadata accepted.",
      next_status: "Ready For AI Quote",
      storage_path: storagePath,
      received: parsed.data
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

  const { data: photo, error } = await supabase
    .from("job_photos")
    .insert({
      job_id: jobId,
      survey_id: survey?.id ?? null,
      storage_path: storagePath,
      public_url: null,
      photo_type: parsed.data.photo_type,
      caption: parsed.data.caption || null
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
    message: "Photo metadata saved to Supabase.",
    next_status: "Ready For AI Quote",
    storage_path: storagePath,
    photo
  });
}
