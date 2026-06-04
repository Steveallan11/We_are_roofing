"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onTranscript: (transcript: string) => void;
  onAudio?: (blob: Blob) => void;
};

export function VoiceRecorder({ onTranscript, onAudio }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<unknown>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const finalTranscriptRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const startRecording = async () => {
    setError(null);
    setInterim("");
    finalTranscriptRef.current = "";
    setElapsed(0);

    if (onAudio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          if (onAudio && blob.size > 0) onAudio(blob);
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Microphone access denied");
        return;
      }
    }

    if (supported) {
      const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR() as {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          onresult: ((event: unknown) => void) | null;
          onerror: ((event: unknown) => void) | null;
          onend: (() => void) | null;
          start: () => void;
          stop: () => void;
        };
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-GB";
        recognition.onresult = (event: unknown) => {
          const e = event as {
            resultIndex: number;
            results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>>;
          };
          let interimText = "";
          for (let i = e.resultIndex; i < e.results.length; i += 1) {
            const result = e.results[i];
            const first = result?.[0];
            if (first) {
              if (first.isFinal) {
                finalTranscriptRef.current += first.transcript + " ";
              } else {
                interimText += first.transcript;
              }
            }
          }
          setInterim(interimText);
        };
        recognition.onerror = (event: unknown) => {
          const e = event as { error?: string };
          if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
            setError(`Voice: ${e.error}`);
          }
        };
        recognition.onend = () => {
          if (recognitionRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };
        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {}
      }
    }

    startedAtRef.current = Date.now();
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);

    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const recognition = recognitionRef.current as { stop: () => void } | null;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    const finalText = (finalTranscriptRef.current + " " + interim).trim();
    if (finalText) onTranscript(finalText);
    setInterim("");
  };

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      const recognition = recognitionRef.current as { stop: () => void } | null;
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl transition-all ${
            isRecording
              ? "animate-pulse bg-[#ef4444] text-white shadow-lg shadow-red-500/50"
              : "bg-[#3b82f6] text-white hover:bg-[#2563eb]"
          }`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? "■" : "🎤"}
        </button>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text)]">
            {isRecording ? `Recording… ${formatTime(elapsed)}` : "Tap to record"}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {supported
              ? "Speech will be transcribed automatically"
              : "Audio will be recorded (transcription not supported in this browser)"}
          </p>
        </div>
      </div>

      {(interim || finalTranscriptRef.current) && (
        <div className="rounded border border-[var(--border)] bg-[var(--ink)] p-2 text-sm text-[var(--text)]">
          <span>{finalTranscriptRef.current}</span>
          <span className="text-[var(--text-muted)]">{interim}</span>
        </div>
      )}

      {error && <p className="text-xs text-[#fca5a5]">{error}</p>}
    </div>
  );
}
