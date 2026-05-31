import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensurePrivateStorageBucket, SURVEY_IMAGES_BUCKET } from "@/lib/storage";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ surveyId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { surveyId } = await params;
  if (!canPersistToSupabase()) {
    return NextResponse.json({
      ok: true,
      storage_path: `${surveyId}/preview-image`,
      signed_url: null,
      token: "preview-token"
    });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: survey, error: surveyError } = await supabase.from("roof_surveys").select("job_id").eq("id", surveyId).single();
  if (surveyError || !survey) {
    return NextResponse.json({ ok: false, error: surveyError?.message ?? "Roof survey not found." }, { status: 404 });
  }

  const bucketResult = await ensurePrivateStorageBucket(supabase, SURVEY_IMAGES_BUCKET);
  if (!bucketResult.ok) {
    return NextResponse.json({ ok: false, error: bucketResult.error }, { status: 500 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: string;
      file_name?: string;
      content_type?: string;
      storage_path?: string;
    };

    if (body.mode === "create-upload") {
      const extension = getImageExtension(body.file_name, body.content_type);
      const storagePath = `${survey.job_id}/${surveyId}/satellite-${Date.now()}.${extension}`;
      const signedUpload = await supabase.storage.from(SURVEY_IMAGES_BUCKET).createSignedUploadUrl(storagePath);

      if (signedUpload.error || !signedUpload.data) {
        return NextResponse.json({ ok: false, error: signedUpload.error?.message ?? "Unable to create satellite image upload URL." }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        storage_path: signedUpload.data.path,
        token: signedUpload.data.token
      });
    }

    if (!body.storage_path) {
      return NextResponse.json({ ok: false, error: "storage_path is required." }, { status: 400 });
    }

    return attachSurveyImage(supabase, surveyId, body.storage_path);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Image file is required." }, { status: 400 });
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

  return attachSurveyImage(supabase, surveyId, storagePath);
}

async function attachSurveyImage(supabase: ReturnType<typeof createSupabaseAdminClient>, surveyId: string, storagePath: string) {
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

function getImageExtension(fileName?: string, contentType?: string) {
  const fileExtension = fileName?.split(".").pop()?.toLowerCase();
  if (fileExtension && ["jpg", "jpeg", "png", "webp"].includes(fileExtension)) {
    return fileExtension;
  }
  if (contentType?.includes("jpeg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  return "png";
}
