import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensurePrivateStorageBucket, ensurePublicStorageBucket, getStoragePublicUrl, JOB_PHOTOS_BUCKET, SURVEY_FRAMES_BUCKET, SURVEY_VIDEOS_BUCKET } from "@/lib/storage";
import { extractFrames, type ExtractedFrame } from "@/lib/survey/frameExtractor";
import { transcribeAudio } from "@/lib/survey/audioExtractor";
import { analyseFramesWithOpenAI, buildReviewOnlyAnalysis } from "@/lib/survey/openaiVision";
import { structureSurvey } from "@/lib/survey/surveyStructurer";
import { canPersistToSupabase } from "@/lib/workflows";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

type StoredVideoInput = {
  storagePath: string;
  label: string;
  fileName?: string;
  fileSizeBytes?: number;
  durationSec?: number;
};

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export async function POST(request: Request) {
  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Video survey preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const payload = await readVideoPayload(request, supabase);

  if (!payload.ok) {
    return NextResponse.json({ ok: false, error: payload.error }, { status: 400 });
  }

  const { jobId, videos } = payload;
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
    const [videoBucket, frameBucket, jobPhotoBucket] = await Promise.all([
      ensurePrivateStorageBucket(supabase, SURVEY_VIDEOS_BUCKET),
      ensurePrivateStorageBucket(supabase, SURVEY_FRAMES_BUCKET),
      ensurePublicStorageBucket(supabase, JOB_PHOTOS_BUCKET)
    ]);

    const bucketError = [videoBucket, frameBucket, jobPhotoBucket].find((result) => !result.ok);
    if (bucketError && !bucketError.ok) {
      throw new Error(bucketError.error);
    }

    const framePaths: string[] = [];
    const photoInserts: Array<Record<string, unknown>> = [];
    const allFrames: ExtractedFrame[] = [];
    const transcriptParts: string[] = [];
    const videoFailures: string[] = [];
    const maxFramesPerVideo = videos.length === 1 ? 20 : videos.length === 2 ? 12 : videos.length === 3 ? 8 : 6;

    for (const video of videos) {
      const label = video.label || "Survey video";
      const safeLabel = slugify(label);
      const videoLog: Record<string, unknown> = {
        survey_id: survey.id,
        job_id: jobId,
        storage_path: video.storagePath,
        file_name: video.fileName || null,
        file_size_bytes: video.fileSizeBytes || null,
        duration_sec: video.durationSec || null,
        label,
        status: "processing"
      };

      try {
        const download = await supabase.storage.from(SURVEY_VIDEOS_BUCKET).download(video.storagePath);
        if (download.error || !download.data) {
          throw new Error(download.error?.message || `Could not download ${label}.`);
        }

        const videoBuffer = Buffer.from(await download.data.arrayBuffer());
        const frames = await extractFrames(videoBuffer, {
          intervalSeconds: 2,
          maxFrames: maxFramesPerVideo,
          surveyId: survey.id,
          label
        });

        for (const [frameIndex, frame] of frames.entries()) {
          const frameStoragePath = `${jobId}/${survey.id}/${safeLabel}-frame-${frameIndex + 1}-${frame.timestamp}s.jpg`;
          const publicFramePath = `${jobId}/${survey.id}/job-photo-${safeLabel}-frame-${frameIndex + 1}-${frame.timestamp}s.jpg`;

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
            caption: `[${label}] Video frame - ${frame.timestamp}s`,
            file_size: frame.buffer.length,
            mime_type: "image/jpeg"
          });
        }

        allFrames.push(...frames);

        const transcript = await transcribeAudio(videoBuffer);
        if (transcript) {
          transcriptParts.push(`[${label}]\n${transcript}`);
        }

        await insertSurveyVideoLog(supabase, {
          ...videoLog,
          frames_extracted: frames.length,
          transcript,
          status: "complete"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : `${label} failed to process.`;
        videoFailures.push(`${label}: ${message}`);
        await insertSurveyVideoLog(supabase, {
          ...videoLog,
          frames_extracted: 0,
          status: "failed",
          error_message: message
        });
      }
    }

    if (allFrames.length === 0) {
      throw new Error(videoFailures[0] || "No usable frames could be extracted from the uploaded videos. Try clearer videos or a different file format.");
    }

    const { data: jobContext } = await supabase
      .from("jobs")
      .select("job_title, property_address, customers(full_name)")
      .eq("id", jobId)
      .maybeSingle();

    const transcript = transcriptParts.join("\n\n---\n\n");
    const customer = Array.isArray(jobContext?.customers) ? jobContext.customers[0] : jobContext?.customers;
    const analysis = await analyseFramesWithOpenAI(allFrames, transcript, {
      jobTitle: jobContext?.job_title,
      propertyAddress: jobContext?.property_address,
      customerName: customer?.full_name,
      multiVideo: videos.length > 1,
      videoLabels: videos.map((video) => video.label)
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "OpenAI could not analyse these videos.";
      return buildReviewOnlyAnalysis(message, "The videos were uploaded and frames were extracted, but AI analysis needs review.", transcript);
    });

    if (videoFailures.length > 0) {
      analysis.review_items = [
        ...(Array.isArray(analysis.review_items) ? analysis.review_items : []),
        ...videoFailures.map((failure) => ({
          field: "video_upload",
          reason: "One of the uploaded videos could not be processed.",
          evidence: failure,
          confidence: 0
        }))
      ];
      analysis.manual_review_needed = Array.from(new Set([...(Array.isArray(analysis.manual_review_needed) ? analysis.manual_review_needed : []), "video_upload"]));
    }

    const structured = structureSurvey(analysis, transcript);
    const isReviewOnly = analysis.is_roof_survey === false || Number(analysis.overall_confidence ?? 0) < 20;
    const durationSeconds = videos.reduce((total, video) => total + (Number.isFinite(video.durationSec) ? Number(video.durationSec) : 0), 0);

    const updatedSurvey = {
      ...structured,
      video_path: videos.map((video) => video.storagePath).join(","),
      video_duration_sec: durationSeconds > 0 ? Math.round(durationSeconds) : allFrames[allFrames.length - 1]?.timestamp ?? null,
      frames_extracted: allFrames.length,
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
      transcript,
      videosProcessed: videos.length - videoFailures.length,
      totalFrames: allFrames.length
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

async function readVideoPayload(request: Request, supabase: AdminSupabaseClient): Promise<{ ok: true; jobId: string; videos: StoredVideoInput[] } | { ok: false; error: string }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { jobId?: unknown; videos?: unknown } | null;
    const jobId = String(body?.jobId || "");
    const videos = Array.isArray(body?.videos) ? body.videos : [];

    if (!jobId || videos.length === 0) {
      return { ok: false, error: "Missing job id or uploaded videos." };
    }

    const cleanVideos = videos.slice(0, 4).map((video, index) => {
        const item = video as Record<string, unknown>;
        return {
          storagePath: String(item.storagePath || ""),
          label: String(item.label || `Video ${index + 1}`),
          fileName: item.fileName ? String(item.fileName) : undefined,
          fileSizeBytes: Number.isFinite(Number(item.fileSizeBytes)) ? Number(item.fileSizeBytes) : undefined,
          durationSec: Number.isFinite(Number(item.durationSec)) ? Number(item.durationSec) : undefined
        };
      }).filter((video) => video.storagePath);

    if (cleanVideos.length === 0) {
      return { ok: false, error: "No uploaded video storage paths were provided." };
    }

    return {
      ok: true,
      jobId,
      videos: cleanVideos
    };
  }

  const formData = await request.formData();
  const videoFile = formData.get("video");
  const jobId = String(formData.get("jobId") || "");
  const durationSec = Number(formData.get("durationSec") || 0);

  if (!(videoFile instanceof File) || !jobId) {
    return { ok: false, error: "Missing video file or job id." };
  }

  const bucket = await ensurePrivateStorageBucket(supabase, SURVEY_VIDEOS_BUCKET);
  if (!bucket.ok) {
    return { ok: false, error: bucket.error };
  }

  const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
  const safeName = slugify(videoFile.name.replace(/\.[^.]+$/, "")) || "source";
  const extension = extensionFromFile(videoFile.name, videoFile.type);
  const storagePath = `${jobId}/legacy/${Date.now()}-${safeName}${extension}`;
  const upload = await supabase.storage.from(SURVEY_VIDEOS_BUCKET).upload(storagePath, videoBuffer, {
    contentType: videoFile.type || "video/webm",
    upsert: true
  });

  if (upload.error) {
    return { ok: false, error: upload.error.message };
  }

  return {
    ok: true,
    jobId,
    videos: [
      {
        storagePath,
        label: "Video 1",
        fileName: videoFile.name,
        fileSizeBytes: videoFile.size,
        durationSec: durationSec > 0 ? durationSec : undefined
      }
    ]
  };
}

async function insertSurveyVideoLog(supabase: AdminSupabaseClient, row: Record<string, unknown>) {
  const { error } = await supabase.from("survey_videos").insert(row);
  if (error) {
    console.warn(`survey_videos log skipped: ${error.message}`);
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "video";
}

function extensionFromFile(fileName: string, mimeType: string) {
  const match = fileName.match(/\.[a-zA-Z0-9]+$/);
  if (match) return match[0].toLowerCase();
  if (mimeType.includes("quicktime")) return ".mov";
  if (mimeType.includes("mp4")) return ".mp4";
  return ".webm";
}
