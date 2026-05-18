"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SurveyAdaptiveSections, SurveyRecord } from "@/lib/types";

type Props = {
  jobId: string;
  customerName: string;
  jobTitle: string;
  propertyAddress: string;
  initialMode?: "record" | "import";
};

type ProcessingResult = {
  surveyId: string;
  survey: Partial<SurveyRecord>;
  analysis: Record<string, any>;
  transcript: string;
};

type ReviewState = {
  surveyor_name: string;
  survey_type: string;
  roof_type: string;
  roof_condition: string;
  problem_observed: string;
  suspected_cause: string;
  recommended_works: string;
  measurements: string;
  access_notes: string;
  scaffold_required: boolean;
  scaffold_notes: string;
  safety_notes: string;
  weather_notes: string;
  customer_concerns: string;
  voice_note_transcript: string;
  raw_notes: string;
  no_photo_confirmation: boolean;
  adaptive_sections: SurveyAdaptiveSections;
};

const STEP_LABELS = ["Video uploaded", "Frames extracted", "Audio transcribed", "AI analysis complete", "Survey ready"];

export function VideoSurveyWorkspace({ jobId, customerName, jobTitle, propertyAddress, initialMode = "record" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"record" | "import">(initialMode);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (mode !== "record") {
      stopCamera();
      return;
    }

    let active = true;
    void navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: true
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((cameraError) => {
        setError(cameraError instanceof Error ? cameraError.message : "Camera access failed.");
      });

    return () => {
      active = false;
      stopCamera();
    };
  }, [mode]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!processing) return;
    setProcessingStep(0);
    const timer = window.setInterval(() => {
      setProcessingStep((current) => Math.min(current + 1, STEP_LABELS.length - 1));
    }, 2200);
    return () => window.clearInterval(timer);
  }, [processing]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const confidenceItems = useMemo(() => {
    if (!result) return [];
    const analysis = result.analysis || {};
    return [
      { label: "Roof type", value: Number(analysis.overall_confidence || 0) },
      { label: "Condition", value: Number(analysis.condition_confidence || analysis.overall_confidence || 0) },
      { label: "Problems", value: Number(analysis.overall_confidence || 0) },
      { label: "Recommendations", value: Number(analysis.overall_confidence || 0) }
    ];
  }, [result]);

  function stopCamera() {
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  function onSelectFile(file: File | null) {
    setError(null);
    setResult(null);
    setReviewState(null);
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function startRecording() {
    const stream = mediaStreamRef.current;
    if (!stream) {
      setError("Camera stream is not ready yet.");
      return;
    }

    setError(null);
    setRecordingSeconds(0);
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm"
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const file = new File([blob], `survey-${Date.now()}.webm`, { type: blob.type || "video/webm" });
      onSelectFile(file);
      setRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function processVideo() {
    if (!selectedFile) {
      setError("Choose or record a video first.");
      return;
    }

    setProcessing(true);
    setError(null);
    const formData = new FormData();
    formData.append("video", selectedFile);
    formData.append("jobId", jobId);
    if (recordingSeconds > 0) {
      formData.append("durationSec", String(recordingSeconds));
    }

    const response = await fetch("/api/survey/process-video", {
      method: "POST",
      body: formData
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string; surveyId?: string; survey?: Partial<SurveyRecord>; analysis?: Record<string, any>; transcript?: string }
      | null;

    setProcessing(false);
    setProcessingStep(STEP_LABELS.length - 1);

    if (!response.ok || !payload?.ok || !payload.surveyId || !payload.survey) {
      setError(payload?.error || "Video survey processing failed.");
      return;
    }

    const nextResult: ProcessingResult = {
      surveyId: payload.surveyId,
      survey: payload.survey,
      analysis: payload.analysis || {},
      transcript: payload.transcript || ""
    };

    setResult(nextResult);
    setReviewState({
      surveyor_name: payload.survey.surveyor_name || "Andrew Bailey",
      survey_type: payload.survey.survey_type || "Other / Misc",
      roof_type: payload.survey.roof_type || "Other",
      roof_condition: payload.survey.roof_condition || "",
      problem_observed: payload.survey.problem_observed || "",
      suspected_cause: payload.survey.suspected_cause || "",
      recommended_works: payload.survey.recommended_works || "",
      measurements: payload.survey.measurements || "",
      access_notes: payload.survey.access_notes || "",
      scaffold_required: Boolean(payload.survey.scaffold_required),
      scaffold_notes: payload.survey.scaffold_notes || "",
      safety_notes: payload.survey.safety_notes || "",
      weather_notes: payload.survey.weather_notes || "",
      customer_concerns: payload.survey.customer_concerns || "",
      voice_note_transcript: payload.survey.voice_note_transcript || payload.transcript || "",
      raw_notes: payload.survey.raw_notes || "",
      no_photo_confirmation: Boolean(payload.survey.no_photo_confirmation),
      adaptive_sections: payload.survey.adaptive_sections || {}
    });
  }

  async function saveReview() {
    if (!reviewState) return;
    setError(null);

    const response = await fetch(`/api/jobs/${jobId}/survey`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reviewState)
    });

    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Survey review could not be saved.");
      return;
    }

    startTransition(() => {
      router.push(`/jobs/${jobId}`);
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <div className="card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Summary label="Customer" value={customerName} />
          <Summary label="Job" value={jobTitle} />
          <Summary label="Address" value={propertyAddress} />
          <Summary label="Mode" value={mode === "record" ? "Record Now" : "Import Video"} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-5">
          <div className="flex gap-2">
            <button className={mode === "record" ? "button-primary" : "button-ghost"} onClick={() => setMode("record")} type="button">
              Record Now
            </button>
            <button className={mode === "import" ? "button-primary" : "button-ghost"} onClick={() => setMode("import")} type="button">
              Import Video
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-[8px] border border-[var(--border)] bg-black">
            {mode === "record" ? (
              <div className="relative aspect-video">
                <video autoPlay className="h-full w-full object-cover" muted playsInline ref={videoRef} />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[rgba(0,0,0,0.55)] px-4 py-3 text-sm text-white">
                  <span>{recording ? `Listening on site notes | ${formatDuration(recordingSeconds)}` : "Rear camera preview"}</span>
                  <span>{recording ? "Recording" : "Ready"}</span>
                </div>
              </div>
            ) : previewUrl ? (
              <video className="aspect-video w-full bg-black object-contain" controls src={previewUrl} />
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-[var(--muted)]">Choose a survey video to preview it here.</div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {mode === "record" ? (
              recording ? (
                <button className="button-primary" onClick={stopRecording} type="button">
                  Stop Recording
                </button>
              ) : (
                <button className="button-primary" onClick={startRecording} type="button">
                  Start Recording
                </button>
              )
            ) : null}

            <label className="button-secondary cursor-pointer">
              {selectedFile ? "Replace Video" : mode === "record" ? "Import Instead" : "Choose Video"}
              <input
                accept="video/*"
                className="hidden"
                onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>

            <button className="button-ghost" disabled={!selectedFile || processing} onClick={processVideo} type="button">
              {processing ? "Processing..." : "Process Video"}
            </button>
          </div>

          {selectedFile ? (
            <div className="mt-4 rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
              <p className="text-white">{selectedFile.name}</p>
              <p className="mt-1 text-[var(--muted)]">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB {recordingSeconds > 0 ? `| ${formatDuration(recordingSeconds)}` : ""}
              </p>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
        </div>

        <div className="card p-5">
          <p className="section-kicker text-[0.65rem] uppercase">Processing</p>
          <div className="mt-4 space-y-3">
            {STEP_LABELS.map((label, index) => {
              const active = processing ? index <= processingStep : Boolean(result) && index < STEP_LABELS.length;
              return (
                <div className={`rounded-[8px] border p-3 ${active ? "border-[var(--gold)] bg-[rgba(212,175,55,0.14)]" : "border-[var(--border)] bg-[var(--card)]"}`} key={label}>
                  <p className={`text-sm font-semibold ${active ? "text-[var(--gold-l)]" : "text-[var(--muted)]"}`}>{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {result && reviewState ? (
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="stack">
            <div className="card p-5">
              <p className="section-kicker text-[0.65rem] uppercase">Confidence</p>
              <div className="mt-4 space-y-3">
                {confidenceItems.map((item) => (
                  <ConfidenceRow key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            </div>
            <div className="card p-5">
              <p className="section-kicker text-[0.65rem] uppercase">Transcript</p>
              <p className="mt-3 whitespace-pre-line text-sm text-[var(--text)]">{result.transcript || "No transcript returned."}</p>
            </div>
          </div>

          <div className="card p-5">
            <p className="section-kicker text-[0.65rem] uppercase">Review Survey</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Surveyor" onChange={(value) => setReviewState((current) => (current ? { ...current, surveyor_name: value } : current))} value={reviewState.surveyor_name} />
              <Field label="Survey Type" onChange={(value) => setReviewState((current) => (current ? { ...current, survey_type: value } : current))} value={reviewState.survey_type} />
              <Field label="Roof Type" onChange={(value) => setReviewState((current) => (current ? { ...current, roof_type: value } : current))} value={reviewState.roof_type} />
              <Field label="Condition" onChange={(value) => setReviewState((current) => (current ? { ...current, roof_condition: value } : current))} value={reviewState.roof_condition} />
              <Field label="Problem Observed" multiline onChange={(value) => setReviewState((current) => (current ? { ...current, problem_observed: value } : current))} value={reviewState.problem_observed} />
              <Field label="Suspected Cause" multiline onChange={(value) => setReviewState((current) => (current ? { ...current, suspected_cause: value } : current))} value={reviewState.suspected_cause} />
              <Field label="Recommended Works" multiline onChange={(value) => setReviewState((current) => (current ? { ...current, recommended_works: value } : current))} value={reviewState.recommended_works} />
              <Field label="Access Notes" multiline onChange={(value) => setReviewState((current) => (current ? { ...current, access_notes: value } : current))} value={reviewState.access_notes} />
              <Field label="Scaffold Notes" multiline onChange={(value) => setReviewState((current) => (current ? { ...current, scaffold_notes: value } : current))} value={reviewState.scaffold_notes} />
              <Field label="Safety Notes" multiline onChange={(value) => setReviewState((current) => (current ? { ...current, safety_notes: value } : current))} value={reviewState.safety_notes} />
              <Field label="Measurements" multiline onChange={(value) => setReviewState((current) => (current ? { ...current, measurements: value } : current))} value={reviewState.measurements} />
              <Field label="Raw Notes" multiline onChange={(value) => setReviewState((current) => (current ? { ...current, raw_notes: value } : current))} value={reviewState.raw_notes} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="button-primary" disabled={isPending} onClick={saveReview} type="button">
                {isPending ? "Saving..." : "Save Survey Review"}
              </button>
              <button className="button-ghost" onClick={() => router.push(`/jobs/${jobId}/survey`)} type="button">
                Open Manual Survey
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] p-4">
      <p className="label">{label}</p>
      <p className="mt-2 text-sm text-white">{value}</p>
    </div>
  );
}

function ConfidenceRow({ label, value }: { label: string; value: number }) {
  const tone = value >= 85 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text)]">{label}</span>
        <span style={{ color: tone }}>{Math.max(0, Math.min(100, Math.round(value)))}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--card)]">
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} className="h-full rounded-full" />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {multiline ? (
        <textarea className="field min-h-28" onChange={(event) => onChange(event.target.value)} value={value} />
      ) : (
        <input className="field" onChange={(event) => onChange(event.target.value)} value={value} />
      )}
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
