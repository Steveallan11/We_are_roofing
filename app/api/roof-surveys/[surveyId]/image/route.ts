import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensurePrivateStorageBucket, SURVEY_IMAGES_BUCKET } from "@/lib/storage";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ surveyId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { surveyId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Image file is required." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      storage_path: `${surveyId}/preview-image`,
      signed_url: URL.createObjectURL(file)
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: survey, error: surveyError } = await supabase.from("roof_surveys").select("job_id").eq("id", surveyId).single();
  if (surveyError || !survey) {
    return NextResponse.json({ ok: false, error: surveyError?.message ?? "Roof survey not found." }, { status: 404 });
  }

  const bucketResult = await ensurePrivateStorageBucket(supabase, SURVEY_IMAGES_BUCKET);
  if (!bucketResult.ok) {
    return NextResponse.json({ ok: false, error: bucketResult.error }, { status: 500 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const storagePath = `${survey.job_id}/${surveyId}/satellite.${extension}`;
  const upload = await supabase.storage.from(SURVEY_IMAGES_BUCKET).upload(storagePath, file, {
    contentType: file.type || `image/${extension}`,
    upsert: true
  });

  if (upload.error) {
    return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 });
  }

  const { error: updateError } = await supabase.from("roof_surveys").update({ satellite_image_path: storagePath }).eq("id", surveyId);
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  const signed = await supabase.storage.from(SURVEY_IMAGES_BUCKET).createSignedUrl(storagePath, 60 * 60 * 12);
  return NextResponse.json({
    ok: true,
    storage_path: storagePath,
    signed_url: signed.data?.signedUrl ?? null
  });
}
