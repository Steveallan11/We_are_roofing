"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  jobId: string;
};

const DOCUMENT_TYPES = [
  { value: "expense_receipt", label: "Receipt / supplier invoice" },
  { value: "customer_upload", label: "Customer document" },
  { value: "supplier_quote", label: "Supplier quote" },
  { value: "building_control", label: "Building control" },
  { value: "insurance_document", label: "Insurance document" },
  { value: "warranty_document", label: "Warranty / guarantee" },
  { value: "site_document", label: "Site document" }
];

const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;

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
      let uploadedCount = 0;
      const failures: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_DOCUMENT_SIZE) {
          failures.push(`${file.name} is larger than 25 MB.`);
          continue;
        }

        const prepareResponse = await fetch(`/api/jobs/${jobId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "create-upload",
            document_type: documentType,
            file_name: file.name,
            file_size: file.size,
            content_type: file.type || "application/octet-stream"
          })
        });
        const prepareResult = (await prepareResponse.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          storage_path?: string;
          token?: string;
        } | null;
        if (!prepareResponse.ok || !prepareResult?.ok || !prepareResult.storage_path || !prepareResult.token) {
          failures.push(`${file.name}: ${prepareResult?.error || uploadStatusMessage(prepareResponse.status)}`);
          continue;
        }

        const storageUpload = await getSupabaseBrowserClient()
          .storage.from("job-documents")
          .uploadToSignedUrl(prepareResult.storage_path, prepareResult.token, file, {
            contentType: file.type || "application/octet-stream"
          });
        if (storageUpload.error) {
          failures.push(`${file.name}: ${storageUpload.error.message}`);
          continue;
        }

        const completeResponse = await fetch(`/api/jobs/${jobId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "complete-upload",
            document_type: documentType,
            display_name: displayName.trim() && files.length === 1 ? displayName.trim() : file.name,
            storage_path: prepareResult.storage_path
          })
        });
        const completeResult = (await completeResponse.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!completeResponse.ok || !completeResult?.ok) {
          failures.push(`${file.name}: ${completeResult?.error || uploadStatusMessage(completeResponse.status)}`);
          continue;
        }
        uploadedCount += 1;
      }

      if (uploadedCount > 0) {
        setDisplayName("");
        setMessage(`${uploadedCount} document${uploadedCount === 1 ? "" : "s"} added to this job file.`);
        startTransition(() => router.refresh());
      }
      if (failures.length > 0) {
        setError(failures.join(" "));
      }
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
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Upload PDFs, images, Word docs, supplier quotes, warranties, or reports up to 25 MB. You can attach them when sending a quote.</p>
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
            disabled={isPending || uploading}
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

function uploadStatusMessage(status: number) {
  if (status === 413) return "file is too large for the upload service";
  if (status === 401 || status === 403) return "your session expired; refresh and sign in again";
  return "upload failed";
}
