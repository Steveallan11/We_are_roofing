"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MaterialRecord, SupplierRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

type Props = {
  jobId: string;
  quoteId?: string | null;
  initialMaterials: MaterialRecord[];
  suppliers: SupplierRecord[];
};

const STATUS_OPTIONS = ["Definitely Needed", "May Be Needed", "Optional", "Check On Site"];

export function MaterialsEditor({ jobId, quoteId, initialMaterials, suppliers }: Props) {
  const router = useRouter();
  const [materials, setMaterials] = useState(initialMaterials);
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

  const materialTotal = materials.reduce((sum, material) => sum + Number(material.total_cost ?? (Number(material.quantity || 0) * Number(material.unit_cost || 0))), 0);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-kicker text-[0.65rem] uppercase">Editable Materials</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Edit quantities, unit costs, suppliers and ordering status. Changes auto-save on blur.</p>
        </div>
        <button className="button-primary" disabled={isPending} onClick={addMaterial} type="button">
          + Add Item
        </button>
      </div>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit Cost</th>
              <th>Total</th>
              <th>Supplier</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {materials.map((material) => {
              const rowTotal = Number(material.total_cost ?? Number(material.quantity || 0) * Number(material.unit_cost || 0));
              return (
                <tr key={material.id}>
                  <td>
                    <input className="field min-w-56" onBlur={() => saveMaterial(material, { item_name: material.item_name })} onChange={(event) => updateLocal(material.id, { item_name: event.target.value })} value={material.item_name} />
                  </td>
                  <td>
                    <input className="field w-24" onBlur={() => saveMaterial(material, { quantity: Number(material.quantity || 0), unit_cost: material.unit_cost ?? null })} onChange={(event) => updateLocal(material.id, { quantity: Number(event.target.value || 0) })} type="number" value={material.quantity ?? 0} />
                  </td>
                  <td>
                    <input className="field w-24" onBlur={() => saveMaterial(material, { unit: material.unit })} onChange={(event) => updateLocal(material.id, { unit: event.target.value })} value={material.unit ?? ""} />
                  </td>
                  <td>
                    <input className="field w-28" onBlur={() => saveMaterial(material, { unit_cost: material.unit_cost ?? 0, quantity: Number(material.quantity || 0) })} onChange={(event) => updateLocal(material.id, { unit_cost: Number(event.target.value || 0) })} step="0.01" type="number" value={material.unit_cost ?? 0} />
                  </td>
                  <td className="font-semibold text-[var(--gold-l)]">{currency(rowTotal)}</td>
                  <td>
                    <select className="field min-w-40" onChange={(event) => { updateLocal(material.id, { supplier: event.target.value || null }); void saveMaterial(material, { supplier: event.target.value || null }); }} value={material.supplier ?? ""}>
                      <option value="">No supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.name}>
                          {supplier.is_preferred ? "★ " : ""}{supplier.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="field min-w-40" onChange={(event) => { updateLocal(material.id, { required_status: event.target.value as MaterialRecord["required_status"] }); void saveMaterial(material, { required_status: event.target.value as MaterialRecord["required_status"] }); }} value={material.required_status}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="text-xs text-[#ff9a91]" onClick={() => deleteMaterial(material.id)} type="button">
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Materials Total</td>
              <td>{currency(materialTotal)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
      {(message || error) ? <p className={`p-5 text-sm ${error ? "text-[#ff9a91]" : "text-[#7ce3a6]"}`}>{error || message}</p> : null}
    </div>
  );
}
