"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { MaterialRecord, SupplierRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

type Props = {
  jobId: string;
  quoteId?: string | null;
  initialMaterials: MaterialRecord[];
  suppliers: SupplierRecord[];
};

const STATUS_OPTIONS: Array<MaterialRecord["required_status"]> = ["Definitely Needed", "May Be Needed", "Check On Site", "Optional"];

const STATUS_COPY: Record<string, { label: string; hint: string; tone: string }> = {
  "Definitely Needed": {
    label: "Need to order",
    hint: "Required for the job",
    tone: "border-[#10b981]/35 bg-[#10b981]/10 text-[#9df0bd]"
  },
  "May Be Needed": {
    label: "Check before ordering",
    hint: "Likely but needs confirming",
    tone: "border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#ffd38b]"
  },
  "Check On Site": {
    label: "Check on site",
    hint: "Confirm during survey or prep",
    tone: "border-[#3b82f6]/35 bg-[#3b82f6]/10 text-[#b8d4ff]"
  },
  Optional: {
    label: "Optional",
    hint: "Allowance or nice-to-have",
    tone: "border-[var(--border)] bg-black/20 text-[var(--muted)]"
  }
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "Definitely Needed", label: "Need to order" },
  { id: "May Be Needed", label: "Check first" },
  { id: "Check On Site", label: "On site check" },
  { id: "Optional", label: "Optional" }
] as const;

export function MaterialsEditor({ jobId, quoteId, initialMaterials, suppliers }: Props) {
  const router = useRouter();
  const [materials, setMaterials] = useState(initialMaterials);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateLocal(id: string, updates: Partial<MaterialRecord>) {
    setMaterials((current) => current.map((material) => (material.id === id ? { ...material, ...updates } : material)));
  }

  async function saveMaterial(material: MaterialRecord, updates: Partial<MaterialRecord>) {
    setError(null);
    const nextQuantity = updates.quantity ?? material.quantity;
    const nextUnitCost = updates.unit_cost ?? material.unit_cost;
    const response = await fetch(`/api/materials/${material.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...updates,
        current_quantity: nextQuantity,
        current_unit_cost: nextUnitCost
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; material?: MaterialRecord } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Material could not be saved.");
      return;
    }
    if (result.material) updateLocal(material.id, result.material);
    setMessage("Materials saved.");
  }

  async function addMaterial() {
    setError(null);
    const response = await fetch(`/api/jobs/${jobId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId, item_name: "New material", category: "General", quantity: 1, unit: "item" })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; material?: MaterialRecord } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Material could not be added.");
      return;
    }
    if (result.material) setMaterials((current) => [...current, result.material as MaterialRecord]);
    setMessage("Material added.");
    startTransition(() => router.refresh());
  }

  async function deleteMaterial(id: string) {
    const response = await fetch(`/api/materials/${id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Material could not be deleted.");
      return;
    }
    setMaterials((current) => current.filter((material) => material.id !== id));
  }

  const materialTotal = materials.reduce((sum, material) => sum + getMaterialTotal(material), 0);
  const requiredCount = materials.filter((material) => material.required_status === "Definitely Needed").length;
  const checkCount = materials.filter((material) => material.required_status === "May Be Needed" || material.required_status === "Check On Site").length;
  const supplierCount = new Set(materials.map((material) => material.supplier).filter(Boolean)).size;
  const visibleMaterials = activeFilter === "all" ? materials : materials.filter((material) => material.required_status === activeFilter);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-kicker text-[0.65rem] uppercase">Materials Tracker</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Confirm what is needed, assign suppliers, and keep ordering notes in one place.</p>
        </div>
        <button className="button-primary" disabled={isPending} onClick={addMaterial} type="button">
          Add Material
        </button>
      </div>

      <div className="border-b border-[var(--border)] bg-black/10 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Need to order" value={String(requiredCount)} hint="Definitely required" />
          <SummaryTile label="Check first" value={String(checkCount)} hint="May be needed or site check" />
          <SummaryTile label="Suppliers" value={String(supplierCount)} hint="Assigned on this list" />
          <SummaryTile label="Estimated total" value={currency(materialTotal)} hint="Based on unit costs entered" />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <button
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${
                  active ? "border-[var(--gold)] bg-[var(--gold)] text-black" : "border-[var(--border)] bg-black/20 text-[var(--muted)] hover:border-[var(--gold)]/60"
                }`}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 p-5">
        {visibleMaterials.length > 0 ? (
          visibleMaterials.map((material) => (
            <MaterialCard
              deleteMaterial={deleteMaterial}
              key={material.id}
              material={material}
              saveMaterial={saveMaterial}
              suppliers={suppliers}
              updateLocal={updateLocal}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-5 text-sm text-[var(--muted)]">
            No materials match this filter yet.
          </div>
        )}
      </div>
      {message || error ? <p className={`border-t border-[var(--border)] p-5 text-sm ${error ? "text-[#ff9a91]" : "text-[#7ce3a6]"}`}>{error || message}</p> : null}
    </div>
  );
}

function MaterialCard({
  material,
  suppliers,
  updateLocal,
  saveMaterial,
  deleteMaterial
}: {
  material: MaterialRecord;
  suppliers: SupplierRecord[];
  updateLocal: (id: string, updates: Partial<MaterialRecord>) => void;
  saveMaterial: (material: MaterialRecord, updates: Partial<MaterialRecord>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
}) {
  const rowTotal = getMaterialTotal(material);
  const statusCopy = STATUS_COPY[material.required_status] ?? STATUS_COPY.Optional;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] ${statusCopy.tone}`}>
              {statusCopy.label}
            </span>
            <span className="text-xs text-[var(--muted)]">{statusCopy.hint}</span>
          </div>
          <input
            className="field mt-3 w-full text-base font-semibold"
            onBlur={() => saveMaterial(material, { item_name: material.item_name })}
            onChange={(event) => updateLocal(material.id, { item_name: event.target.value })}
            value={material.item_name}
          />
        </div>
        <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-4 py-3 lg:min-w-40 lg:text-right">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Line total</p>
          <p className="mt-1 text-xl font-semibold text-white">{currency(rowTotal)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <FieldBlock label="Quantity">
          <input
            className="field"
            onBlur={() => saveMaterial(material, { quantity: Number(material.quantity || 0), unit_cost: material.unit_cost ?? null })}
            onChange={(event) => updateLocal(material.id, { quantity: Number(event.target.value || 0) })}
            type="number"
            value={material.quantity ?? 0}
          />
        </FieldBlock>
        <FieldBlock label="Unit">
          <input
            className="field"
            onBlur={() => saveMaterial(material, { unit: material.unit })}
            onChange={(event) => updateLocal(material.id, { unit: event.target.value })}
            value={material.unit ?? ""}
          />
        </FieldBlock>
        <FieldBlock label="Unit cost">
          <input
            className="field"
            onBlur={() => saveMaterial(material, { unit_cost: material.unit_cost ?? 0, quantity: Number(material.quantity || 0) })}
            onChange={(event) => updateLocal(material.id, { unit_cost: Number(event.target.value || 0) })}
            step="0.01"
            type="number"
            value={material.unit_cost ?? 0}
          />
        </FieldBlock>
        <FieldBlock label="Supplier">
          <select
            className="field"
            onChange={(event) => {
              updateLocal(material.id, { supplier: event.target.value || null });
              void saveMaterial(material, { supplier: event.target.value || null });
            }}
            value={material.supplier ?? ""}
          >
            <option value="">No supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.name}>
                {supplier.is_preferred ? "Preferred - " : ""}{supplier.name}
              </option>
            ))}
          </select>
        </FieldBlock>
        <FieldBlock label="Status">
          <select
            className="field"
            onChange={(event) => {
              updateLocal(material.id, { required_status: event.target.value as MaterialRecord["required_status"] });
              void saveMaterial(material, { required_status: event.target.value as MaterialRecord["required_status"] });
            }}
            value={material.required_status}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_COPY[status]?.label ?? status}
              </option>
            ))}
          </select>
        </FieldBlock>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <FieldBlock label="Notes">
          <textarea
            className="field min-h-20"
            onBlur={() => saveMaterial(material, { notes: material.notes ?? "" })}
            onChange={(event) => updateLocal(material.id, { notes: event.target.value })}
            placeholder="Ordering notes, colour, supplier reference, delivery instructions..."
            value={material.notes ?? ""}
          />
        </FieldBlock>
        <button className="button-ghost !border-[#ef4444]/35 !px-4 !py-2 text-sm !text-[#ffb4ad]" onClick={() => deleteMaterial(material.id)} type="button">
          Delete
        </button>
      </div>
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function getMaterialTotal(material: MaterialRecord) {
  return Number(material.total_cost ?? Number(material.quantity || 0) * Number(material.unit_cost || 0));
}
