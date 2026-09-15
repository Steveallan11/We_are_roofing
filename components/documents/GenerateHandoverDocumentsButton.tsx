"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function GenerateHandoverDocumentsButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true); setMessage(null); setError(null);
    const response = await fetch(`/api/jobs/${jobId}/handover-documents`, { method: "POST" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    setBusy(false);
    if (!response.ok || !result?.ok) { setError(result?.error || "Documents could not be generated."); return; }
    setMessage(result.message || "Documents created.");
    router.refresh();
  }

  return (
    <div>
      <Button variant="primary" size="md" onClick={generate} disabled={busy}>{busy ? "Creating PDFs..." : "Create completion & warranty PDFs"}</Button>
      {message ? <p className="mt-2 text-xs text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}
