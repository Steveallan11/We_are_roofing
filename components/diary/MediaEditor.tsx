"use client";

import { useState } from "react";
import { DrawingCanvas } from "./DrawingCanvas";
import { CameraCapture } from "./CameraCapture";

type Mode = "picker" | "drawing" | "camera" | "upload" | "uploading";

type Props = {
  onMediaAdded: (url: string, caption?: string) => void;
  onClose: () => void;
};

export function MediaEditor({ onMediaAdded, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("picker");
  const [error, setError] = useState<string | null>(null);

  const handleDrawingSave = async (blob: Blob) => {
    setMode("uploading");
    try {
      const formData = new FormData();
      formData.append("file", blob, "drawing.png");
      const response = await fetch("/api/diary/upload", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (data?.ok) {
        onMediaAdded(data.url, "Drawing");
      } else {
        setError(data?.error || "Upload failed");
        setMode("drawing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setMode("drawing");
    }
  };

  const handleCaptureSave = async (blob: Blob) => {
    setMode("uploading");
    try {
      const formData = new FormData();
      formData.append("file", blob, "capture.jpg");
      const response = await fetch("/api/diary/upload", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (data?.ok) {
        onMediaAdded(data.url, "Photo");
      } else {
        setError(data?.error || "Upload failed");
        setMode("camera");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setMode("camera");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files?.length) return;
    setMode("uploading");

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/diary/upload", {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        if (data?.ok) {
          onMediaAdded(data.url, file.name);
        } else {
          throw new Error(data?.error || "Upload failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setMode("picker");
    }
  };

  if (mode === "drawing") {
    return <DrawingCanvas onSave={handleDrawingSave} onCancel={() => setMode("picker")} />;
  }

  if (mode === "camera") {
    return <CameraCapture onCapture={handleCaptureSave} onCancel={() => setMode("picker")} />;
  }

  if (mode === "uploading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-[var(--surface)] p-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">Uploading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm space-y-3 rounded-lg bg-[var(--surface)] p-4">
        <h3 className="font-semibold text-[var(--text)]">Add media</h3>
        {error && <p className="text-xs text-[#fca5a5]">{error}</p>}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMode("drawing")}
            className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] p-3 text-left hover:bg-[var(--ink)]"
          >
            <span className="text-2xl">✏️</span>
            <div>
              <p className="font-medium text-[var(--text)]">Draw or sketch</p>
              <p className="text-xs text-[var(--text-muted)]">Use canvas to sketch notes</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("camera")}
            className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] p-3 text-left hover:bg-[var(--ink)]"
          >
            <span className="text-2xl">📷</span>
            <div>
              <p className="font-medium text-[var(--text)]">Take photo</p>
              <p className="text-xs text-[var(--text-muted)]">Camera or selfie</p>
            </div>
          </button>
          <label className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] p-3 text-left hover:bg-[var(--ink)]">
            <span className="text-2xl">📂</span>
            <div>
              <p className="font-medium text-[var(--text)]">Upload file</p>
              <p className="text-xs text-[var(--text-muted)]">Image or video</p>
            </div>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
              multiple
            />
          </label>
        </div>
        <div className="border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
