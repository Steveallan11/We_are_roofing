"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function KnowledgeAdmin() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [importMode, setImportMode] = useState<"quotes" | "knowledge" | "all">("all");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [entryMessage, setEntryMessage] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);

  async function runImport() {
    setImportMessage(null);
    setImportError(null);
    const response = await fetch("/api/admin/knowledge/import-notion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 25, mode: importMode })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    if (!response.ok || !result?.ok) {
      setImportError(result?.error || "Notion import failed.");
      return;
    }
    setImportMessage(result.message || "Notion import completed.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Notion Import</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Pull the live `Quotes` database into historical comparables and the `Master Source Library` into reusable knowledge records. This is migration and enrichment, not day-to-day dual entry.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="field min-w-[220px]"
              disabled={isPending}
              onChange={(event) => setImportMode(event.target.value as "quotes" | "knowledge" | "all")}
              value={importMode}
            >
              <option value="all">Import Quotes + Knowledge</option>
              <option value="quotes">Import Quotes Only</option>
              <option value="knowledge">Import Knowledge Only</option>
            </select>
            <button className="button-primary" disabled={isPending} onClick={runImport} type="button">
              {isPending ? "Importing..." : "Import From Notion"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="label">Quotes Source</p>
            <p className="text-sm text-[var(--text)]">`📋 Quotes` data source</p>
            <p className="mt-2 text-xs text-[var(--muted)]">Imports quote title, quote ref, work description, price, stage, and comparable tags into `historical_quotes`.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="label">Knowledge Source</p>
            <p className="text-sm text-[var(--text)]">`🧠 Master Source Library` data source</p>
            <p className="mt-2 text-xs text-[var(--muted)]">Imports curated pricing anchors, wording, scope, materials, and retrieval hints into `knowledge_base`.</p>
          </div>
        </div>
        {importMessage ? <p className="mt-4 text-sm text-[#7ce3a6]">{importMessage}</p> : null}
        {importError ? <p className="mt-4 text-sm text-[#ff9a91]">{importError}</p> : null}
      </div>

      <form
        className="card p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setEntryError(null);
          setEntryMessage(null);
          const formData = new FormData(event.currentTarget);
          const response = await fetch("/api/admin/knowledge/examples", {
            method: "POST",
            body: formData
          });
          const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
          if (!response.ok || !result?.ok) {
            setEntryError(result?.error || "Knowledge example could not be saved.");
            return;
          }
          setEntryMessage(result.message || "Knowledge example saved.");
          (event.currentTarget as HTMLFormElement).reset();
          startTransition(() => router.refresh());
        }}
      >
        <p className="section-kicker text-[0.65rem] uppercase">Add Example</p>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="title">
                Title
              </label>
              <input className="field" id="title" name="title" placeholder="Flat roof replacement example" required />
            </div>
            <div>
              <label className="label" htmlFor="record_type">
                Save As
              </label>
              <select className="field" defaultValue="historical_quote" id="record_type" name="record_type">
                <option value="historical_quote">Historical Quote Example</option>
                <option value="knowledge_base">Knowledge Base Entry</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="category">
                Category
              </label>
              <select className="field" defaultValue="Historical Quote" id="category" name="category">
                <option value="Historical Quote">Historical Quote</option>
                <option value="Quote Template">Quote Template</option>
                <option value="Pricing Reference">Pricing Reference</option>
                <option value="Scope Of Works">Scope Of Works</option>
                <option value="Roof Report Style">Roof Report Style</option>
                <option value="Materials System">Materials System</option>
                <option value="Terms">Terms</option>
                <option value="Email Style">Email Style</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="tags">
                Tags
              </label>
              <input className="field" id="tags" name="tags" placeholder="flat, replacement, danosa" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="content">
              Text Content
            </label>
            <textarea className="field min-h-40" id="content" name="content" placeholder="Paste wording, pricing notes, materials notes, or the full historical quote text here." />
          </div>
          <div>
            <label className="label" htmlFor="file">
              Optional File Upload
            </label>
            <input className="field" id="file" name="file" type="file" />
          </div>
          <button className="button-secondary w-fit" disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Save Example"}
          </button>
        </div>
        {entryMessage ? <p className="mt-4 text-sm text-[#7ce3a6]">{entryMessage}</p> : null}
        {entryError ? <p className="mt-4 text-sm text-[#ff9a91]">{entryError}</p> : null}
      </form>
    </div>
  );
}
