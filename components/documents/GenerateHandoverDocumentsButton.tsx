"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function GenerateHandoverDocumentsButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warrantyYears, setWarrantyYears] = useState(15);

  async function generate() {
    setBusy(true); setMessage(null); setError(null);
    const response = await fetch(`/api/jobs/${jobId}/handover-documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ warranty_years: warrantyYears }) });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setBusy(false);
    if (!response.ok || !result?.ok) { setError(result?.error || "Documents could not be generated."); return; }
    setMessage(result.message || "Documents created.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label>
        <span className="label">Warranty length</span>
        <select className="field min-h-11 min-w-36" onChange={(event) => setWarrantyYears(Number(event.target.value))} value={warrantyYears}>
          {[5, 10, 15, 20, 25].map((years) => <option key={years} value={years}>{years} years</option>)}
        </select>
      </label>
      <Button variant="primary" size="md" onClick={generate} disabled={busy}>{busy ? "Creating PDFs..." : "Create completion & warranty PDFs"}</Button>
      {message ? <p className="mt-2 text-xs text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}
