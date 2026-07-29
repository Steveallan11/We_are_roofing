"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { analyseReceiptFile, type ReceiptAnalysis } from "@/lib/receipts/analyseReceiptFile";
import type { Customer, Job, JobExpenseCategory, ReceiptInboxRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

type ReceiptJob = Job & { customer?: Customer | null };

type ReceiptForm = {
  supplier_name: string;
  description: string;
  category: JobExpenseCategory;
  amount: string;
  vat_amount: string;
  expense_date: string;
  notes: string;
  job_id: string;
};

const CATEGORIES: Array<{ value: JobExpenseCategory; label: string }> = [
  { value: "materials", label: "Materials" },
  { value: "labour", label: "Labour" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "plant_hire", label: "Plant hire" },
  { value: "skip_hire", label: "Skip hire" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "fuel", label: "Fuel / travel" },
  { value: "waste", label: "Waste" },
  { value: "other", label: "Other" }
];

export function ReceiptInbox({
  jobs,
  initialReceipts
}: {
  jobs: ReceiptJob[];
  initialReceipts: ReceiptInboxRecord[];
}) {
  const [receipts, setReceipts] = useState(initialReceipts);
  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState<ReceiptForm>(emptyForm());
  const [analysingReceipt, setAnalysingReceipt] = useState(false);
  const [receiptAnalysis, setReceiptAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [receiptAnalysisError, setReceiptAnalysisError] = useState<string | null>(null);

  useEffect(() => setReceipts(initialReceipts), [initialReceipts]);

  function stageFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const selected = Array.from(fileList);
    const accepted = selected.filter(
      (file) => (file.type.startsWith("image/") || file.type === "application/pdf") && file.size <= 15 * 1024 * 1024
    );
    if (accepted.length !== selected.length) {
      setError("Only images and PDFs up to 15MB can be added.");
    }
    const receiptImage = accepted.length === 1 && files.length === 0 && accepted[0].type.startsWith("image/") ? accepted[0] : null;
    if (receiptImage) void analyseInboxReceipt(receiptImage);
    setFiles((current) => [...current, ...accepted]);
  }

  async function analyseInboxReceipt(file: File) {
    setAnalysingReceipt(true);
    setReceiptAnalysis(null);
    setReceiptAnalysisError(null);
    try {
      const analysis = await analyseReceiptFile(file);
      setReceiptAnalysis(analysis);
      setUploadForm((current) => ({
        ...current,
        supplier_name: current.supplier_name.trim() || analysis.supplier_name || "",
        description: current.description.trim() || analysis.description,
        category: analysis.category,
        amount: current.amount || (analysis.amount_total == null ? "" : String(analysis.amount_total)),
        vat_amount: current.vat_amount || (analysis.vat_amount == null ? "" : String(analysis.vat_amount)),
        expense_date: analysis.receipt_date || current.expense_date
      }));
    } catch (analysisError) {
      setReceiptAnalysisError(analysisError instanceof Error ? analysisError.message : "AI could not read this receipt.");
    } finally {
      setAnalysingReceipt(false);
    }
  }

  async function uploadReceipts() {
    if (files.length === 0) {
      setError("Take a photo or choose at least one receipt.");
      return;
    }

    setUploading(true);
    setMessage(null);
    setError(null);
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("display_name", file.name);
        appendReceiptFields(formData, uploadForm);
        const response = await fetch("/api/receipts", { method: "POST", body: formData });
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          receipt?: ReceiptInboxRecord;
          error?: string;
        } | null;
        if (!response.ok || !result?.ok || !result.receipt) {
          throw new Error(result?.error || `Could not upload ${file.name}.`);
        }
        return result.receipt;
      })
    );

    const uploaded: ReceiptInboxRecord[] = [];
    const failed: File[] = [];
    const errors: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") uploaded.push(result.value);
      else {
        failed.push(files[index]);
        errors.push(result.reason instanceof Error ? result.reason.message : `Could not upload ${files[index].name}.`);
      }
    });

    setUploading(false);
    setReceipts((current) => [...uploaded, ...current]);
    setFiles(failed);
    if (uploaded.length > 0) {
      setMessage(`${uploaded.length} receipt${uploaded.length === 1 ? "" : "s"} saved to the inbox.`);
      if (failed.length === 0) {
        setUploadForm(emptyForm());
        setReceiptAnalysis(null);
        setReceiptAnalysisError(null);
        setShowUpload(false);
      }
    }
    if (errors.length > 0) setError(errors.join(" "));
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Receipt inbox</p>
          <h3 className="mt-1 font-display text-2xl text-[var(--text)]">Receipts waiting to be filed</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Add a receipt now, even if you do not know the job or final cost yet. It will not affect expenses or profit until you assign it.
          </p>
        </div>
        <button
          className="button-primary min-h-11 shrink-0"
          onClick={() => setShowUpload((current) => !current)}
          type="button"
        >
          {showUpload ? "Close" : "+ Add unassigned receipt"}
        </button>
      </div>

      {message ? <p className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {showUpload ? (
        <div className="mt-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--surface-raised)] p-4">
          <p className="font-semibold text-[var(--text)]">Add receipt to inbox</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Only the photo or PDF is required. Add any details you know now, or update them later.</p>
          <ReceiptFields form={uploadForm} onChange={setUploadForm} showJob={false} jobs={jobs} />
          {analysingReceipt ? (
            <div aria-live="polite" className="mt-3 rounded-lg border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3 py-3" role="status">
              <p className="text-sm font-bold text-[var(--text)]">AI is reading the receipt...</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Checking supplier, date, amount, VAT, and purchase type.</p>
            </div>
          ) : null}
          {receiptAnalysis ? (
            <div aria-live="polite" className="mt-3 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-3" role="status">
              <p className="text-sm font-bold text-[var(--text)]">AI filled the details | {receiptAnalysis.confidence} confidence</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Please check the values before filing.
                {receiptAnalysis.review_notes.length > 0 ? ` ${receiptAnalysis.review_notes.join(" ")}` : ""}
              </p>
            </div>
          ) : null}
          {receiptAnalysisError ? (
            <div aria-live="polite" className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-3" role="status">
              <p className="text-sm font-bold text-[var(--text)]">AI could not fill this one automatically</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{receiptAnalysisError} You can still save the receipt and update it later.</p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="button-primary min-h-11 cursor-pointer text-center">
              Take photo
              <input
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  stageFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
            <label className="button-secondary min-h-11 cursor-pointer text-center">
              Choose images / PDFs
              <input
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                multiple
                onChange={(event) => {
                  stageFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
          </div>
          {files.length > 0 ? (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2" key={`${file.name}-${file.size}-${index}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text)]">{file.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    className="min-h-11 px-3 text-xs font-semibold text-red-600"
                    onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <button
            className="button-primary mt-4 min-h-11 w-full sm:w-auto"
            disabled={uploading || analysingReceipt || files.length === 0}
            onClick={uploadReceipts}
            type="button"
          >
            {analysingReceipt
              ? "AI reading receipt..."
              : uploading
                ? "Saving receipts..."
                : `Save ${files.length || ""} receipt${files.length === 1 ? "" : "s"} to inbox`}
          </button>
        </div>
      ) : null}

      {receipts.length > 0 ? (
        <div className="mt-4 space-y-3">
          {receipts.map((receipt) => (
            <PendingReceiptCard
              jobs={jobs}
              key={receipt.id}
              onError={setError}
              onRemove={(id) => setReceipts((current) => current.filter((receiptItem) => receiptItem.id !== id))}
              onSaved={(updated) => setReceipts((current) => current.map((item) => (item.id === updated.id ? updated : item)))}
              onSuccess={setMessage}
              receipt={receipt}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <p className="font-semibold text-[var(--text)]">Inbox clear</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">All uploaded receipts have been filed against jobs.</p>
        </div>
      )}
    </section>
  );
}

function PendingReceiptCard({
  receipt,
  jobs,
  onSaved,
  onRemove,
  onSuccess,
  onError
}: {
  receipt: ReceiptInboxRecord;
  jobs: ReceiptJob[];
  onSaved: (receipt: ReceiptInboxRecord) => void;
  onRemove: (id: string) => void;
  onSuccess: (message: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => formFromReceipt(receipt));
  const [busy, setBusy] = useState<"save" | "assign" | "delete" | null>(null);

  async function save() {
    setBusy("save");
    onSuccess(null);
    onError(null);
    const response = await fetch("/api/receipts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt_id: receipt.id, ...receiptPayload(form) })
    });
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      receipt?: ReceiptInboxRecord;
      error?: string;
    } | null;
    setBusy(null);
    if (!response.ok || !result?.ok || !result.receipt) {
      onError(result?.error || "Receipt details could not be saved.");
      return;
    }
    onSaved(result.receipt);
    onSuccess("Receipt details updated.");
  }

  async function assign() {
    setBusy("assign");
    onSuccess(null);
    onError(null);
    const response = await fetch("/api/receipts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        receipt_id: receipt.id,
        ...receiptPayload(form)
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      onError(result?.error || "Receipt could not be assigned.");
      return;
    }
    onRemove(receipt.id);
    onSuccess("Receipt assigned. The expense and document are now on the job.");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete "${receipt.display_name}" from the receipt inbox?`)) return;
    setBusy("delete");
    onSuccess(null);
    onError(null);
    const response = await fetch("/api/receipts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt_id: receipt.id })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      onError(result?.error || "Receipt could not be deleted.");
      return;
    }
    onRemove(receipt.id);
    onSuccess("Receipt deleted.");
  }

  return (
    <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--text)]">{receipt.description || receipt.display_name}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {receipt.supplier_name || "Supplier not added"} | {receipt.amount != null ? currency(receipt.amount) : "Amount not added"} | Waiting for job
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700">
            To file
          </span>
        </div>
      </summary>

      <ReceiptFields form={form} jobs={jobs} onChange={setForm} showJob />
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="button-secondary min-h-11" href={`/api/receipts/${receipt.id}/file`} rel="noreferrer" target="_blank">
          Open receipt
        </a>
        <button className="button-secondary min-h-11" disabled={busy !== null} onClick={save} type="button">
          {busy === "save" ? "Saving..." : "Save details"}
        </button>
        <button
          className="button-primary min-h-11"
          disabled={busy !== null || !form.job_id || !form.description.trim() || !(Number(form.amount) > 0)}
          onClick={assign}
          type="button"
        >
          {busy === "assign" ? "Assigning..." : "Assign to job"}
        </button>
        <button className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-600" disabled={busy !== null} onClick={remove} type="button">
          {busy === "delete" ? "Deleting..." : "Delete"}
        </button>
      </div>
      {!form.job_id || !form.description.trim() || !(Number(form.amount) > 0) ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Choose a job and enter the description and amount to enable assignment.</p>
      ) : null}
    </details>
  );
}

function ReceiptFields({
  form,
  onChange,
  showJob,
  jobs
}: {
  form: ReceiptForm;
  onChange: (form: ReceiptForm) => void;
  showJob: boolean;
  jobs: ReceiptJob[];
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {showJob ? (
        <label className="block sm:col-span-2">
          <span className="label">Assign to job</span>
          <select className="field min-h-11" onChange={(event) => onChange({ ...form, job_id: event.target.value })} value={form.job_id}>
            <option value="">Choose job...</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.job_ref || "No ref"} - {job.job_title}
                {job.customer?.full_name ? ` - ${job.customer.full_name}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block">
        <span className="label">Date</span>
        <input className="field min-h-11" onChange={(event) => onChange({ ...form, expense_date: event.target.value })} type="date" value={form.expense_date} />
      </label>
      <label className="block">
        <span className="label">Category</span>
        <select
          className="field min-h-11"
          onChange={(event) => onChange({ ...form, category: event.target.value as JobExpenseCategory })}
          value={form.category}
        >
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Supplier (optional)</span>
        <input className="field min-h-11" onChange={(event) => onChange({ ...form, supplier_name: event.target.value })} value={form.supplier_name} />
      </label>
      <label className="block">
        <span className="label">Description</span>
        <input
          className="field min-h-11"
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          placeholder="e.g. Roofing materials"
          value={form.description}
        />
      </label>
      <label className="block">
        <span className="label">Amount inc VAT (GBP)</span>
        <input
          className="field min-h-11"
          inputMode="decimal"
          min="0"
          onChange={(event) => onChange({ ...form, amount: event.target.value })}
          step="0.01"
          type="number"
          value={form.amount}
        />
      </label>
      <label className="block">
        <span className="label">Of which VAT (GBP)</span>
        <input
          className="field min-h-11"
          inputMode="decimal"
          min="0"
          onChange={(event) => onChange({ ...form, vat_amount: event.target.value })}
          step="0.01"
          type="number"
          value={form.vat_amount}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Notes (optional)</span>
        <input className="field min-h-11" onChange={(event) => onChange({ ...form, notes: event.target.value })} value={form.notes} />
      </label>
    </div>
  );
}

function emptyForm(): ReceiptForm {
  return {
    supplier_name: "",
    description: "",
    category: "other",
    amount: "",
    vat_amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    notes: "",
    job_id: ""
  };
}

function formFromReceipt(receipt: ReceiptInboxRecord): ReceiptForm {
  return {
    supplier_name: receipt.supplier_name ?? "",
    description: receipt.description ?? "",
    category: receipt.category,
    amount: receipt.amount == null ? "" : String(receipt.amount),
    vat_amount: receipt.vat_amount ? String(receipt.vat_amount) : "",
    expense_date: receipt.expense_date,
    notes: receipt.notes ?? "",
    job_id: ""
  };
}

function receiptPayload(form: ReceiptForm) {
  return {
    supplier_name: form.supplier_name || null,
    description: form.description || null,
    category: form.category,
    amount: form.amount === "" ? null : Number(form.amount),
    vat_amount: form.vat_amount === "" ? 0 : Number(form.vat_amount),
    expense_date: form.expense_date,
    notes: form.notes || null,
    job_id: form.job_id || null
  };
}

function appendReceiptFields(formData: FormData, form: ReceiptForm) {
  formData.append("supplier_name", form.supplier_name);
  formData.append("description", form.description);
  formData.append("category", form.category);
  formData.append("amount", form.amount);
  formData.append("vat_amount", form.vat_amount);
  formData.append("expense_date", form.expense_date);
  formData.append("notes", form.notes);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
