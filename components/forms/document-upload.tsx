"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  jobId: string;
};

const DOCUMENT_TYPES = [
  { value: "customer_upload", label: "Customer document" },
  { value: "supplier_quote", label: "Supplier quote" },
  { value: "building_control", label: "Building control" },
  { value: "insurance_document", label: "Insurance document" },
  { value: "warranty_document", label: "Warranty / guarantee" },
  { value: "site_document", label: "Site document" }
];

export function DocumentUploadButton({ jobId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0].value);
  const [displayName, setDisplayName] = useState("");
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
        formData.append("document_type", documentType);
        if (displayName.trim() && files.length === 1) {
          formData.append("display_name", displayName.trim());
        }

        const response = await fetch(`/api/jobs/${jobId}/documents`, {
          method: "POST",
          body: formData
        });

        const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || `Upload failed for ${file.name}`);
        }
      }

      setDisplayName("");
      setMessage(`${files.length} document${files.length === 1 ? "" : "s"} added to this job file.`);
      startTransition(() => router.refresh());
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Document upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Add supporting documents</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Upload PDFs, images, Word docs, supplier quotes, warranties, or reports. You can attach them when sending a quote.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,170px)_1fr_auto]">
        <select className="field" disabled={isPending || uploading} onChange={(event) => setDocumentType(event.target.value)} value={documentType}>
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <input
          className="field"
          disabled={isPending || uploading}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Optional display name for one file"
          value={displayName}
        />
        <label className="button-secondary cursor-pointer text-center">
          {uploading || isPending ? "Uploading..." : "Upload Documents"}
          <input
            ref={inputRef}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,image/*"
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
