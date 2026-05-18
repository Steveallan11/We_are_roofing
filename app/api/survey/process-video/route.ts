import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensurePrivateStorageBucket, ensurePublicStorageBucket, getStoragePublicUrl, JOB_PHOTOS_BUCKET, SURVEY_FRAMES_BUCKET, SURVEY_VIDEOS_BUCKET } from "@/lib/storage";
import { extractFrames } from "@/lib/survey/frameExtractor";
import { transcribeAudio } from "@/lib/survey/audioExtractor";
import { analyseFramesWithOpenAI, buildReviewOnlyAnalysis } from "@/lib/survey/openaiVision";
import { structureSurvey } from "@/lib/survey/surveyStructurer";
import { canPersistToSupabase } from "@/lib/workflows";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const formData = await request.formData();
  const videoFile = formData.get("video");
  const jobId = String(formData.get("jobId") || "");
  const durationSec = Number(formData.get("durationSec") || 0);

  if (!(videoFile instanceof File) || !jobId) {
    return NextResponse.json({ ok: false, error: "Missing video file or job id." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Video survey preview completed." });
  }

  const supabase = createSupabaseAdminClient();
  const { data: survey, error: createError } = await supabase
    .from("surveys")
    .insert({
      job_id: jobId,
      surveyor_name: "Andrew Bailey",
      scaffold_required: false,
      problem_observed: "Processing video survey",
      recommended_works: "Pending analysis",
      survey_type: "Other / Misc",
      roof_type: "Other",
      no_photo_confirmation: false,
      source_type: "video",
      processing_status: "processing"
    })
    .select("*")
    .single();

  if (createError || !survey) {
    return NextResponse.json({ ok: false, error: createError?.message ?? "Unable to create survey record." }, { status: 500 });
  }

  try {
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const safeName = videoFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-") || "source.webm";
    const videoStoragePath = `${jobId}/${survey.id}/${Date.now()}-${safeName}`;

    const [videoBucket, frameBucket, jobPhotoBucket] = await Promise.all([
      ensurePrivateStorageBucket(supabase, SURVEY_VIDEOS_BUCKET),
      ensurePrivateStorageBucket(supabase, SURVEY_FRAMES_BUCKET),
      ensurePublicStorageBucket(supabase, JOB_PHOTOS_BUCKET)
    ]);

    const bucketError = [videoBucket, frameBucket, jobPhotoBucket].find((result) => !result.ok);
    if (bucketError && !bucketError.ok) {
      throw new Error(bucketError.error);
    }

    const videoUpload = await supabase.storage.from(SURVEY_VIDEOS_BUCKET).upload(videoStoragePath, videoBuffer, {
      contentType: videoFile.type || "video/webm",
      upsert: true
    });

    if (videoUpload.error) {
      throw new Error(videoUpload.error.message);
    }

    const frames = await extractFrames(videoBuffer, {
      intervalSeconds: 2,
      maxFrames: 20,
      surveyId: survey.id
    });

    if (frames.length === 0) {
      throw new Error("No usable frames could be extracted from this video. Try a clearer video or a different file format.");
    }

    const framePaths: string[] = [];
    const photoInserts: Array<Record<string, unknown>> = [];

    for (const frame of frames) {
      const frameStoragePath = `${jobId}/${survey.id}/frame-${frame.timestamp}s.jpg`;
      const publicFramePath = `${jobId}/${survey.id}/job-photo-frame-${frame.timestamp}s.jpg`;

      const [privateUpload, publicUpload] = await Promise.all([
        supabase.storage.from(SURVEY_FRAMES_BUCKET).upload(frameStoragePath, frame.buffer, {
          contentType: "image/jpeg",
          upsert: true
        }),
        supabase.storage.from(JOB_PHOTOS_BUCKET).upload(publicFramePath, frame.buffer, {
          contentType: "image/jpeg",
          upsert: true
        })
      ]);

      if (privateUpload.error) {
        throw new Error(privateUpload.error.message);
      }
      if (publicUpload.error) {
        throw new Error(publicUpload.error.message);
      }

      framePaths.push(frameStoragePath);
      photoInserts.push({
        job_id: jobId,
        survey_id: survey.id,
        storage_path: publicFramePath,
        public_url: getStoragePublicUrl(supabase, JOB_PHOTOS_BUCKET, publicFramePath),
        photo_type: "General",
        caption: `Video frame - ${frame.timestamp}s`,
        file_size: frame.buffer.length,
        mime_type: "image/jpeg"
      });
    }

    const { data: jobContext } = await supabase
      .from("jobs")
      .select("job_title, property_address, customers(full_name)")
      .eq("id", jobId)
      .maybeSingle();

    const transcript = await transcribeAudio(videoBuffer);
    const customer = Array.isArray(jobContext?.customers) ? jobContext.customers[0] : jobContext?.customers;
    const analysis = await analyseFramesWithOpenAI(frames, transcript, {
      jobTitle: jobContext?.job_title,
      propertyAddress: jobContext?.property_address,
      customerName: customer?.full_name
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "OpenAI could not analyse this video.";
      return buildReviewOnlyAnalysis(message, "The video was uploaded and frames were extracted, but AI analysis needs review.", transcript);
    });
    const structured = structureSurvey(analysis, transcript);
    const isReviewOnly = analysis.is_roof_survey === false || Number(analysis.overall_confidence ?? 0) < 20;

    const updatedSurvey = {
      ...structured,
      video_path: videoStoragePath,
      video_duration_sec: durationSec > 0 ? Math.round(durationSec) : frames[frames.length - 1]?.timestamp ?? null,
      frames_extracted: frames.length,
      frame_paths: framePaths,
      updated_at: new Date().toISOString()
    };

    await supabase.from("surveys").update(updatedSurvey).eq("id", survey.id);

    if (photoInserts.length > 0) {
      await supabase.from("job_photos").insert(photoInserts);
    }

    await supabase
      .from("jobs")
      .update({
        status: isReviewOnly ? "Survey Complete" : "Ready For AI Quote",
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId);

    return NextResponse.json({
      ok: true,
      surveyId: survey.id,
      survey: {
        ...survey,
        ...updatedSurvey
      },
      analysis,
      transcript
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video survey processing failed.";
    await supabase
      .from("surveys")
      .update({
        processing_status: "failed",
        processing_error: message,
        updated_at: new Date().toISOString()
      })
      .eq("id", survey.id);

    return NextResponse.json({ ok: false, error: message, surveyId: survey.id }, { status: 500 });
  }
}
