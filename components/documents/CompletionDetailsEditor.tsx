"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { getJobDocumentHref } from "@/lib/documents";
import type { JobCompletionDetails, JobVariationRecord } from "@/lib/types";

type Props = {
  jobId: string;
  initialScope: string;
  variations: JobVariationRecord[];
  savedDetails?: JobCompletionDetails | null;
  handoverDocuments?: Array<Pick<import("@/lib/types").JobDocumentRecord, "id" | "document_type" | "display_name" | "quote_id" | "invoice_id">>;
};

export function CompletionDetailsEditor({ jobId, initialScope, variations, savedDetails, handoverDocuments = [] }: Props) {
  const router = useRouter();
  const approvedVariations = variations.filter((variation) => ["Accepted", "Invoiced", "Paid"].includes(variation.status));
  const [scope, setScope] = useState(savedDetails?.works_summary || initialScope);
  const [installedSystem, setInstalledSystem] = useState(savedDetails?.installed_system || "");
  const [productDetails, setProductDetails] = useState(savedDetails?.product_details || "");
  const [warrantyYears, setWarrantyYears] = useState(savedDetails?.warranty_years ?? 15);
  const [warrantyDetails, setWarrantyDetails] = useState(savedDetails?.warranty_details || "");
  const [generatedDocuments, setGeneratedDocuments] = useState(handoverDocuments);
  const [includedIds, setIncludedIds] = useState<string[]>(savedDetails
    ? savedDetails.included_variation_ids
    : approvedVariations.map((variation) => variation.id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(regenerateDocuments = false) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/jobs/${jobId}/completion-details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ works_summary: scope, installed_system: installedSystem, product_details: productDetails, warranty_years: warrantyYears, warranty_details: warrantyDetails, included_variation_ids: includedIds })
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Completion details could not be saved.");
      if (regenerateDocuments) {
        const documentsResponse = await fetch(`/api/jobs/${jobId}/handover-documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warranty_years: warrantyYears })
        });
        const documentResult = (await documentsResponse.json()) as { ok?: boolean; message?: string; error?: string; documents?: typeof generatedDocuments };
        if (!documentsResponse.ok || !documentResult.ok) throw new Error(documentResult.error ?? "The edits were saved, but PDFs could not be regenerated.");
        setGeneratedDocuments(documentResult.documents ?? []);
        setMessage("Edits saved and both PDFs regenerated from the latest details.");
      } else {
        setMessage(result.message ?? "Saved.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Completion details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-4 p-4" aria-label="Edit completion document">
      <div>
        <h2 className="font-semibold text-[var(--text)]">Completion scope</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Record each part of the accepted scope that was completed, including preparation, installation, flashings, drainage, finishing and checks as relevant. This completion-specific record does not change the accepted quote.</p>
      </div>
      <label className="block">
        <span className="label">Works completed</span>
        <textarea className="field min-h-36" maxLength={12000} onChange={(event) => setScope(event.target.value)} value={scope} />
      </label>
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <label className="block">
          <span className="label">Workmanship warranty length</span>
          <select className="field min-h-11" onChange={(event) => setWarrantyYears(Number(event.target.value))} value={warrantyYears}>
            {[5, 10, 15, 20, 25].map((years) => <option key={years} value={years}>{years} years</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Warranty cover / relevant terms</span>
          <textarea className="field min-h-24" maxLength={6000} onChange={(event) => setWarrantyDetails(event.target.value)} placeholder="Describe the workmanship cover and any job-specific limits or conditions. Leave blank to use the standard workmanship wording." value={warrantyDetails} />
        </label>
      </div>
      <label className="block">
        <span className="label">Installed roofing system</span>
        <textarea className="field min-h-20" maxLength={2000} onChange={(event) => setInstalledSystem(event.target.value)} placeholder="System/type, roof area or location, build-up and key installation details" value={installedSystem} />
      </label>
      <label className="block">
        <span className="label">Product and manufacturer details</span>
        <textarea className="field min-h-24" maxLength={6000} onChange={(event) => setProductDetails(event.target.value)} placeholder="Manufacturer, product/range, material, colour/profile, batch or product references where known. Leave unknown details blank rather than guessing." value={productDetails} />
      </label>
      {approvedVariations.length ? (
        <fieldset className="space-y-2">
          <legend className="label">Approved additional work to show as completed</legend>
          {approvedVariations.map((variation) => (
            <label className="flex items-start gap-2 text-sm" key={variation.id}>
              <input checked={includedIds.includes(variation.id)} onChange={(event) => setIncludedIds((current) => event.target.checked ? [...current, variation.id] : current.filter((id) => id !== variation.id))} type="checkbox" />
              <span><strong>{variation.variation_ref} · {variation.title}</strong>{variation.description ? <span className="block text-[var(--text-muted)]">{variation.description}</span> : null}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={saving || !scope.trim()} onClick={() => void save(false)} size="sm" variant="secondary">{saving ? "Saving…" : "Save edits"}</Button>
        <Button disabled={saving || !scope.trim()} onClick={() => void save(true)} size="sm" variant="primary">{saving ? "Saving & creating PDFs…" : "Save & create latest PDFs"}</Button>
        {message ? <span className="text-sm text-emerald-700" role="status">{message}</span> : null}
        {error ? <span className="text-sm text-red-600" role="alert">{error}</span> : null}
      </div>
      <div className="border-t border-[var(--border)] pt-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">Latest saved completion documents</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Use “Save & create latest PDFs” to replace these with PDFs containing your current edits.</p>
        {generatedDocuments.length ? <div className="mt-2 flex flex-wrap gap-3">
          {generatedDocuments.map((document) => <a className="text-sm font-semibold text-[var(--gold-d)] underline" href={getJobDocumentHref(document)} key={document.id} rel="noreferrer" target="_blank">Open {document.display_name}</a>)}
        </div> : <p className="mt-2 text-sm text-[var(--text-muted)]">No completion or warranty PDFs have been generated for this job yet.</p>}
      </div>
    </section>
  );
}
