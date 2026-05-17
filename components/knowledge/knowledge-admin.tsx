"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type BulkUploadResult = {
  file_name: string;
  parsed: number;
  inserted_historical_quotes: number;
  updated_historical_quotes?: number;
  inserted_knowledge_entries: number;
  updated_knowledge_entries?: number;
  skipped_duplicates: number;
  warning?: string;
  error?: string;
};

export function KnowledgeAdmin() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [importMode, setImportMode] = useState<"quotes" | "knowledge" | "all">("all");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [entryMessage, setEntryMessage] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<BulkUploadResult[]>([]);

  function addFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    setUploadFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [...current, ...nextFiles.filter((file) => !existing.has(`${file.name}:${file.size}`))];
    });
  }

  async function uploadKnowledgeFiles() {
    if (uploadFiles.length === 0) {
      setUploadError("Choose at least one file to upload.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);
    setUploadResults([]);

    const formData = new FormData();
    uploadFiles.forEach((file) => formData.append("files", file));
    const response = await fetch("/api/admin/knowledge/bulk-upload", {
      method: "POST",
      body: formData
    });
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      message?: string;
      results?: BulkUploadResult[];
    } | null;

    setUploading(false);
    if (!response.ok || !result?.ok) {
      setUploadError(result?.error || "Knowledge files could not be uploaded.");
      return;
    }

    setUploadMessage(result.message || "Knowledge files processed.");
    setUploadResults(result.results ?? []);
    setUploadFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    startTransition(() => router.refresh());
  }

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

      <div className="card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Bulk Knowledge Upload</p>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Drop CSV, TXT, MD or JSON exports with one or many quotes. The system stores the original file, splits readable quote records, detects totals/year/roof tags, and files them into retrieval.
            </p>
            <p className="mt-2 text-xs text-[var(--dim)]">PDF/DOCX files are stored as source files in this pass, but not text-parsed yet.</p>
          </div>
          <button className="button-secondary !py-2 text-sm" onClick={() => fileInputRef.current?.click()} type="button">
            Choose Files
          </button>
        </div>

        <div
          className={`mt-4 rounded-[1.5rem] border border-dashed p-6 text-center transition ${
            isDragging ? "border-[var(--gold)] bg-[rgba(212,175,55,0.14)]" : "border-[var(--border)] bg-black/20"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
        >
          <input
            accept=".csv,.txt,.md,.json,.pdf,.doc,.docx"
            className="hidden"
            multiple
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
            }}
            ref={fileInputRef}
            type="file"
          />
          <p className="font-display text-3xl text-[var(--gold-l)]">Drop quote files here</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Best format: CSV with columns like title/ref, scope, total, date/year, roof type, job type, tags.</p>
        </div>

        {uploadFiles.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{uploadFiles.length} file{uploadFiles.length === 1 ? "" : "s"} ready</p>
              <button className="text-sm text-[var(--dim)] transition hover:text-[#ff9a91]" onClick={() => setUploadFiles([])} type="button">
                Clear
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {uploadFiles.map((file) => (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm" key={`${file.name}:${file.size}`}>
                  <span className="truncate text-[var(--text)]">{file.name}</span>
                  <span className="shrink-0 text-xs text-[var(--dim)]">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                </div>
              ))}
            </div>
            <button className="button-primary mt-4" disabled={uploading || isPending} onClick={uploadKnowledgeFiles} type="button">
              {uploading ? "Reading And Filing..." : "Upload And File Knowledge"}
            </button>
          </div>
        ) : null}

        {uploadMessage ? <p className="mt-4 text-sm text-[#7ce3a6]">{uploadMessage}</p> : null}
        {uploadError ? <p className="mt-4 text-sm text-[#ff9a91]">{uploadError}</p> : null}
        {uploadResults.length > 0 ? (
          <div className="mt-4 space-y-2">
            {uploadResults.map((result) => (
              <div className="rounded-2xl border border-[var(--border)] p-3 text-sm" key={result.file_name}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{result.file_name}</p>
                  <p className="text-xs text-[var(--dim)]">{result.parsed} parsed · {result.skipped_duplicates} skipped</p>
                </div>
                <p className="mt-1 text-[var(--muted)]">
                  {result.inserted_historical_quotes} quotes filed · {result.updated_historical_quotes ?? 0} quotes updated · {result.inserted_knowledge_entries} knowledge entries filed · {result.updated_knowledge_entries ?? 0} knowledge entries updated
                </p>
                {result.warning ? <p className="mt-1 text-xs text-[#ffd38b]">{result.warning}</p> : null}
                {result.error ? <p className="mt-1 text-xs text-[#ff9a91]">{result.error}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
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
