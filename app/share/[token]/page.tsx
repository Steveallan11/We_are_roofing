import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: Props) {
  const { token } = await params;

  const supabase = createSupabaseAdminClient();

  // Get share record
  const { data: share, error: shareError } = await supabase
    .from("job_document_shares")
    .select("*")
    .eq("share_token", token)
    .eq("is_active", true)
    .single();

  if (shareError || !share) {
    notFound();
  }

  // Check if expired
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    notFound();
  }

  // Get document details
  const { data: document, error: docError } = await supabase
    .from("job_documents")
    .select("*")
    .eq("id", share.document_id)
    .single();

  if (docError || !document) {
    notFound();
  }

  // Get job for context
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", share.job_id)
    .single();

  const fileSize = document.file_size
    ? document.file_size < 1024 * 1024
      ? `${Math.max(1, Math.round(document.file_size / 1024))} KB`
      : `${(document.file_size / 1024 / 1024).toFixed(1)} MB`
    : "Unknown size";

  const isImage = document.mime_type?.startsWith("image/");
  const isPdf = document.mime_type === "application/pdf";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[var(--surface)] to-black">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-condensed text-4xl text-white">Shared Document</h1>
          <p className="mt-2 text-[var(--muted)]">Access shared files for your roofing project</p>
        </div>

        {/* Job Info Card */}
        {job && (
          <div className="mb-6 rounded-2xl border border-[var(--border)] bg-black/20 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--dim)]">Project Details</p>
            <h2 className="mt-3 font-condensed text-2xl text-white">{job.job_title || job.property_address}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
              {job.job_ref && <span>Ref: {job.job_ref}</span>}
              {job.property_address && <span>{job.property_address}</span>}
            </div>
          </div>
        )}

        {/* Document Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--dim)]">Document</p>
          <h3 className="mt-3 font-semibold text-white">{document.display_name}</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
            <span>{document.mime_type || "Unknown type"}</span>
            <span>{fileSize}</span>
            {document.created_at && <span>Shared {formatDate(document.created_at)}</span>}
            {share.expires_at && <span>Expires {formatDate(share.expires_at)}</span>}
          </div>

          {/* Document Preview */}
          {isImage && (
            <div className="mt-6 rounded-xl border border-[var(--border)] bg-black/20 p-4">
              <img
                src={`/api/share/${token}`}
                alt={document.display_name}
                className="max-h-96 w-full rounded object-contain"
              />
            </div>
          )}

          {isPdf && (
            <div className="mt-6 rounded-xl border border-[var(--border)] bg-black/20 p-4">
              <iframe
                src={`/api/share/${token}#toolbar=0`}
                title={document.display_name}
                className="h-96 w-full rounded"
              />
            </div>
          )}

          {!isImage && !isPdf && (
            <div className="mt-6 rounded-xl border border-[var(--border)] bg-black/20 p-4 text-center">
              <p className="text-sm text-[var(--muted)]">This document cannot be previewed in the browser</p>
            </div>
          )}

          {/* Download Button */}
          <div className="mt-6 flex gap-3">
            <form
              action={async () => {
                "use server";
                // The download will be handled by the API endpoint
              }}
            >
              <button
                type="button"
                onClick={() => {
                  window.open(`/api/share/${token}`, "_blank");
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2 font-semibold text-black transition hover:bg-[var(--gold-l)]"
              >
                ↓ Download Document
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted)]">
              This is a secure shared link. Do not share this URL with others as it provides access to this document.
            </p>
          </div>
        </div>

        {/* Branding Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-[var(--text-faint)]">We Are Roofing</p>
        </div>
      </div>
    </div>
  );
}
