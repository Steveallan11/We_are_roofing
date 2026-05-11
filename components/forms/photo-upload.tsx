"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PHOTO_TYPES } from "@/lib/constants";

type Props = {
  jobId: string;
};

export function PhotoUploadButton({ jobId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [photoType, setPhotoType] = useState<(typeof PHOTO_TYPES)[number]>("General");
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    setError(null);
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("photo_type", photoType);
        if (caption.trim()) {
          formData.append("caption", caption.trim());
        }

        const response = await fetch(`/api/jobs/${jobId}/photos`, {
          method: "POST",
          body: formData
        });

        const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || `Upload failed for ${file.name}`);
        }
      }

      setCaption("");
      setMessage(`${files.length} file${files.length === 1 ? "" : "s"} uploaded.`);
      startTransition(() => router.refresh());
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_1fr_auto]">
        <select
          className="field"
          disabled={isPending || uploading}
          onChange={(event) => setPhotoType(event.target.value as (typeof PHOTO_TYPES)[number])}
          value={photoType}
        >
          {PHOTO_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input
          className="field"
          disabled={isPending || uploading}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Optional caption for this upload batch"
          value={caption}
        />
        <label className="button-secondary cursor-pointer text-center">
          {uploading || isPending ? "Uploading..." : "Upload Photos"}
          <input
            ref={inputRef}
            accept="image/*,video/*"
            className="hidden"
            multiple
            onChange={(event) => {
              void onFilesSelected(event.target.files);
            }}
            type="file"
          />
        </label>
      </div>
      {message ? <p className="text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}
