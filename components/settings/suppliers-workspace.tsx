"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SupplierRecord } from "@/lib/types";

type Props = {
  initialSuppliers: SupplierRecord[];
};

const EMPTY_SUPPLIER = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  website: "",
  account_ref: "",
  categories: "",
  notes: "",
  is_preferred: false
};

export function SuppliersWorkspace({ initialSuppliers }: Props) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function editSupplier(supplier: SupplierRecord) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      website: supplier.website ?? "",
      account_ref: supplier.account_ref ?? "",
      categories: (supplier.categories ?? []).join(", "),
      notes: supplier.notes ?? "",
      is_preferred: Boolean(supplier.is_preferred)
    });
  }

  async function saveSupplier() {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/settings/suppliers", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id: editing?.id, categories: form.categories.split(",").map((item) => item.trim()).filter(Boolean) })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; supplier?: SupplierRecord } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Supplier could not be saved.");
      return;
    }

    if (result.supplier) {
      setSuppliers((current) => {
        const exists = current.some((supplier) => supplier.id === result.supplier?.id);
        return exists ? current.map((supplier) => (supplier.id === result.supplier?.id ? result.supplier as SupplierRecord : supplier)) : [...current, result.supplier as SupplierRecord];
      });
    }
    setForm(EMPTY_SUPPLIER);
    setEditing(null);
    setMessage("Supplier saved.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack">
      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">{editing ? "Edit Supplier" : "Add Supplier"}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField label="Supplier name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
          <TextField label="Contact name" value={form.contact_name} onChange={(value) => setForm((current) => ({ ...current, contact_name: value }))} />
          <TextField label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
          <TextField label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
          <TextField label="Website" value={form.website} onChange={(value) => setForm((current) => ({ ...current, website: value }))} />
          <TextField label="Account ref" value={form.account_ref} onChange={(value) => setForm((current) => ({ ...current, account_ref: value }))} />
          <div className="md:col-span-2">
            <TextField label="Categories" value={form.categories} onChange={(value) => setForm((current) => ({ ...current, categories: value }))} placeholder="Tile, Flat Roofing, Timber" />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-3 text-sm text-[var(--text)]">
            <input checked={form.is_preferred} onChange={(event) => setForm((current) => ({ ...current, is_preferred: event.target.checked }))} type="checkbox" />
            Preferred supplier
          </label>
        </div>
        <textarea className="field mt-3 min-h-24" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" value={form.notes} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="button-primary" disabled={isPending} onClick={saveSupplier} type="button">
            {editing ? "Save Supplier" : "+ Add Supplier"}
          </button>
          {editing ? (
            <button className="button-secondary" onClick={() => { setEditing(null); setForm(EMPTY_SUPPLIER); }} type="button">
              Cancel
            </button>
          ) : null}
        </div>
        {message ? <p className="mt-4 text-sm text-[#7ce3a6]">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {suppliers.map((supplier) => (
          <div className="card p-5" key={supplier.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">{supplier.is_preferred ? "Preferred Supplier" : "Supplier"}</p>
                <h2 className="mt-2 font-condensed text-3xl text-white">{supplier.name}</h2>
              </div>
              <button className="button-ghost" onClick={() => editSupplier(supplier)} type="button">
                Edit
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
              {supplier.account_ref ? <p>Account: {supplier.account_ref}</p> : null}
              {supplier.contact_name ? <p>Contact: {supplier.contact_name}</p> : null}
              {supplier.phone ? <p><a href={`tel:${supplier.phone}`}>{supplier.phone}</a></p> : null}
              {supplier.email ? <p><a href={`mailto:${supplier.email}`}>{supplier.email}</a></p> : null}
              {(supplier.categories ?? []).length ? <p>{(supplier.categories ?? []).join(" · ")}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    </label>
  );
}
