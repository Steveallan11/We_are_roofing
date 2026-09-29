"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type DocumentOption = { id: string; display_name: string; mime_type?: string | null; document_type?: string | null };
type PreviewField = { field_path: string; existing?: unknown; proposed?: unknown; applied?: boolean; evidence_class?: string };
type PreviewData = {
  expected_updated_at: string | null;
  update_hash: string;
  changes: PreviewField[];
  conflicts: PreviewField[];
  uncertain: PreviewField[];
  unsupported_fields: PreviewField[];
  validation_errors: Array<{ field_path: string; error: string }>;
  enabled_modules: string[];
  fields_left_blank: number;
  proposal: Record<string, unknown>;
  document: DocumentOption;
};

export function SurveyImportPanel({ jobId, documents }: { jobId: string; documents: DocumentOption[] }) {
  const router = useRouter();
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? "");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!documents.length) {
    return (
      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">AI Fill Survey</p>
        <p className="mt-2 text-sm text-[var(--muted)]">Upload a roof-report PDF or image to Job Documents first. The report will be mapped into structured survey fields for review.</p>
      </div>
    );
  }

  async function buildPreview() {
    setError(null); setMessage(null); setPreview(null);
    const response = await fetch(`/api/jobs/${jobId}/survey/import/document`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document_id: documentId }) });
    const result = await response.json().catch(() => null) as { ok?: boolean; summary?: string; error?: string; data?: PreviewData } | null;
    if (!result?.data) { setError(result?.error ?? "The report could not be analysed."); return; }
    setPreview(result.data); setMessage(result.summary ?? null);
    if (!result.ok && result.data.validation_errors.length) setError("Some extracted values need correction before they can be applied.");
  }

  async function applyPreview() {
    if (!preview) return;
    setError(null); setMessage(null);
    const response = await fetch(`/api/jobs/${jobId}/survey/import`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...preview.proposal, expected_updated_at: preview.expected_updated_at, update_hash: preview.update_hash, confirmed: true })
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; summary?: string; error?: string } | null;
    if (!response.ok || !result?.ok) { setError(result?.error ?? "The reviewed survey update could not be applied."); return; }
    setMessage(result.summary ?? "Structured survey updated."); setPreview(null); router.refresh();
  }

  return (
    <div className="card p-5">
      <p className="section-kicker text-[0.65rem] uppercase">AI Fill Survey From Roof Report</p>
      <p className="mt-2 text-sm text-[var(--muted)]">Creates a structured preview only. Existing manual answers are preserved unless a conflict is explicitly approved.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1"><span className="label">Private job document</span><select className="field mt-1" value={documentId} onChange={(event) => setDocumentId(event.target.value)}>{documents.map((document) => <option key={document.id} value={document.id}>{document.display_name}</option>)}</select></label>
        <button className="button-secondary min-h-11" disabled={isPending || !documentId} onClick={() => startTransition(buildPreview)} type="button">{isPending ? "Reading Report..." : "Build Structured Preview"}</button>
      </div>
      {message ? <p className="mt-4 text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
      {preview ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-[var(--border)] bg-black/10 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Fields ready" value={preview.changes.length} /><Metric label="Conflicts preserved" value={preview.conflicts.filter((item) => !item.applied).length} /><Metric label="Uncertain omitted" value={preview.uncertain.filter((item) => !item.applied).length} /><Metric label="Still blank" value={preview.fields_left_blank} />
          </div>
          <div><p className="label">Active sections</p><p className="mt-1 text-sm text-[var(--text)]">{preview.enabled_modules.join(", ")}</p></div>
          <FieldList title="Structured changes" rows={preview.changes} />
          <FieldList title="Manual conflicts preserved" rows={preview.conflicts.filter((item) => !item.applied)} />
          <FieldList title="Uncertain values omitted" rows={preview.uncertain.filter((item) => !item.applied)} />
          <FieldList title="Unsupported report fields" rows={preview.unsupported_fields} />
          <button className="button-primary w-full sm:w-auto" disabled={isPending || preview.validation_errors.length > 0} onClick={() => startTransition(applyPreview)} type="button">{isPending ? "Applying..." : `Apply ${preview.changes.length} Reviewed Fields`}</button>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-[var(--border)] p-3"><p className="text-xl font-bold text-[var(--text)]">{value}</p><p className="text-xs text-[var(--muted)]">{label}</p></div>; }
function FieldList({ title, rows }: { title: string; rows: PreviewField[] }) { if (!rows.length) return null; return <div><p className="label">{title}</p><div className="mt-2 space-y-2">{rows.slice(0, 30).map((row) => <div className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs" key={`${title}-${row.field_path}`}><span className="font-semibold text-[var(--text)]">{row.field_path}</span>{row.proposed !== undefined ? <span className="ml-2 text-[var(--muted)]">→ {formatValue(row.proposed)}</span> : null}{row.evidence_class ? <span className="ml-2 text-[var(--gold)]">{row.evidence_class}</span> : null}</div>)}</div></div>; }
function formatValue(value: unknown) { if (Array.isArray(value)) return value.join(", "); if (typeof value === "object" && value) return JSON.stringify(value); return String(value ?? "blank"); }
