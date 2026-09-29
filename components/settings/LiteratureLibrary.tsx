"use client";

import { useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LiteratureAsset } from "@/lib/types";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function LiteratureLibrary({ initialItems }: { initialItems: LiteratureAsset[] }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setMessage("That file is over 25 MB.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const prepared = await fetch("/api/literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "create-upload", file_name: file.name, file_size: file.size, content_type: file.type })
      });
      const prepareResult = (await prepared.json().catch(() => null)) as { ok?: boolean; error?: string; storage_path?: string; token?: string } | null;
      if (!prepared.ok || !prepareResult?.storage_path || !prepareResult.token) throw new Error(prepareResult?.error || "Could not prepare the upload.");

      const uploaded = await getSupabaseBrowserClient().storage.from("job-documents").uploadToSignedUrl(prepareResult.storage_path, prepareResult.token, file, { contentType: file.type || "application/octet-stream" });
      if (uploaded.error) throw uploaded.error;

      const completed = await fetch("/api/literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "complete-upload", storage_path: prepareResult.storage_path, display_name: name.trim() || file.name, description: description.trim() })
      });
      const completeResult = (await completed.json().catch(() => null)) as { ok?: boolean; error?: string; literature?: LiteratureAsset } | null;
      if (!completed.ok || !completeResult?.literature) throw new Error(completeResult?.error || "Could not save the brochure.");
      setItems((current) => [...current, completeResult.literature!].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setName("");
      setDescription("");
      setMessage("Added to the customer literature library.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(item: LiteratureAsset) {
    if (!window.confirm(`Remove ${item.display_name} from the library?`)) return;
    const response = await fetch("/api/literature", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    if (!response.ok) {
      setMessage("That file could not be removed.");
      return;
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  return (
    <div className="stack">
      <div className="card p-5">
        <p className="section-kicker">Add customer literature</p>
        <h2 className="mt-2 text-2xl text-[var(--text-primary)]">Upload once, attach whenever you email</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Use this for brochures, product sheets, guarantees and maintenance guides.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label><span className="label">Customer-facing name</span><input className="field mt-2" onChange={(event) => setName(event.target.value)} placeholder="Flat roof systems brochure" value={name} /></label>
          <label><span className="label">Short note</span><input className="field mt-2" onChange={(event) => setDescription(event.target.value)} placeholder="Optional internal description" value={description} /></label>
        </div>
        <label className="button-primary mt-4 inline-flex cursor-pointer">
          {busy ? "Uploading..." : "Choose file"}
          <input ref={inputRef} accept=".pdf,.doc,.docx,image/*" className="hidden" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} type="file" />
        </label>
        {message ? <p className="mt-3 text-sm text-[var(--muted)]">{message}</p> : null}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="section-kicker">Library</p><h2 className="mt-2 text-2xl text-[var(--text-primary)]">Ready to send</h2></div><span className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)]">{items.length}</span></div>
        <div className="mt-4 grid gap-2">
          {items.length ? items.map((item) => (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-black/20 p-4" key={item.id}>
              <div className="min-w-0"><p className="truncate font-semibold text-[var(--text-primary)]">{item.display_name}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.description || formatFileSize(item.file_size)}</p></div>
              <button className="button-ghost !min-h-10 !px-3 !py-2 text-sm" onClick={() => void remove(item)} type="button">Remove</button>
            </div>
          )) : <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">No brochures or literature uploaded yet.</p>}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(size?: number | null) {
  if (!size) return "Customer attachment";
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
