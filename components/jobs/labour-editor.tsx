"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { LabourEntryRecord, LabourPersonRecord, LabourPlanRecord, LabourRateRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

type Props = {
  jobId: string;
  quoteId?: string | null;
  initialPlan: LabourPlanRecord | null;
  rates: LabourRateRecord[];
  people: LabourPersonRecord[];
};

export function LabourEditor({ jobId, quoteId, initialPlan, rates, people }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [entries, setEntries] = useState(initialPlan?.entries ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const costTotal = entries.reduce((sum, entry) => sum + Number(entry.estimated_cost || 0), 0);
  const chargeTotal = entries.reduce((sum, entry) => sum + Number(entry.charge_total || 0), 0);
  const actualCost = entries.reduce((sum, entry) => sum + Number(entry.actual_cost || 0), 0);
  const margin = chargeTotal > 0 ? ((chargeTotal - costTotal) / chargeTotal) * 100 : 0;

  async function addEntry(rateId?: string) {
    const rate = rates.find((item) => item.id === rateId) ?? rates.find((item) => item.active) ?? rates[0];
    const response = await fetch(`/api/jobs/${jobId}/labour`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_id: quoteId,
        labour_rate_id: rate?.id ?? null,
        role_name: rate?.role_name ?? "Roofer",
        people: 1,
        duration: 1,
        unit: rate?.unit ?? "day",
        cost_rate: rate?.cost_rate ?? 0,
        charge_rate: rate?.charge_rate ?? 0,
        sort_order: entries.length
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; entry?: LabourEntryRecord } | null;
    if (!response.ok || !result?.ok || !result.entry) {
      setError(result?.error || "Labour row could not be added.");
      return;
    }
    setEntries((current) => [...current, result.entry as LabourEntryRecord]);
    setMessage("Labour row added.");
    setError(null);
    startTransition(() => router.refresh());
  }

  async function saveEntry(entry: LabourEntryRecord, updates: Partial<LabourEntryRecord>) {
    const next = { ...entry, ...updates };
    const response = await fetch(`/api/jobs/${jobId}/labour`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_id: entry.id,
        labour_rate_id: next.labour_rate_id,
        person_id: next.person_id,
        role_name: next.role_name,
        people: next.people,
        duration: next.duration,
        unit: next.unit,
        cost_rate: next.cost_rate,
        charge_rate: next.charge_rate,
        actual_duration: next.actual_duration,
        actual_cost: next.actual_cost,
        notes: next.notes,
        sort_order: next.sort_order
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; entry?: LabourEntryRecord } | null;
    if (!response.ok || !result?.ok || !result.entry) {
      setError(result?.error || "Labour row could not be saved.");
      return;
    }
    setEntries((current) => current.map((item) => (item.id === entry.id ? result.entry as LabourEntryRecord : item)));
    setMessage("Labour saved.");
    setError(null);
  }

  async function deleteEntry(entryId: string) {
    const response = await fetch(`/api/jobs/${jobId}/labour?entryId=${encodeURIComponent(entryId)}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Labour row could not be deleted.");
      return;
    }
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    setMessage("Labour row deleted.");
    setError(null);
  }

  async function savePlan(updates: Partial<LabourPlanRecord>) {
    const response = await fetch(`/api/jobs/${jobId}/labour`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId, plan: updates })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; plan?: LabourPlanRecord } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Labour plan could not be saved.");
      return;
    }
    setPlan((current) => ({ ...(current ?? result.plan), ...updates } as LabourPlanRecord));
    setMessage("Labour plan updated.");
  }

  function updateLocal(entryId: string, updates: Partial<LabourEntryRecord>) {
    setEntries((current) => current.map((entry) => (entry.id === entryId ? recalculateEntry({ ...entry, ...updates }) : entry)));
  }

  return (
    <div className="stack">
      <div className="card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Job Labour Plan</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">Crew, days, costs and quote charge</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Build the labour estimate here, then pull the charge total into quote options.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="field min-h-11 w-auto min-w-44" onChange={(event) => event.target.value && addEntry(event.target.value)} value="">
              <option value="">+ Add from role</option>
              {rates.filter((rate) => rate.active !== false).map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {rate.role_name} - {currency(rate.charge_rate)}/{rate.unit}
                </option>
              ))}
            </select>
            <button className="button-secondary" disabled={isPending} onClick={() => addEntry()} type="button">
              + Blank Row
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryTile label="Internal labour cost" value={currency(costTotal)} hint="What it costs the business" />
          <SummaryTile label="Quote labour charge" value={currency(chargeTotal)} hint="Customer-facing labour total" />
          <SummaryTile label="Labour margin" value={`${Math.round(margin)}%`} hint="Charge less estimated cost" />
          <SummaryTile label="Actual cost" value={currency(actualCost)} hint="Filled during or after the job" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Crew Rows</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Assign a person when known. Leave as role-only for early estimating.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                checked={Boolean(plan?.crew_confirmed)}
                onChange={(event) => savePlan({ crew_confirmed: event.target.checked })}
                type="checkbox"
              />
              Crew confirmed
            </label>
            <select
              className="field min-h-11 w-auto"
              onChange={(event) => savePlan({ status: event.target.value as LabourPlanRecord["status"] })}
              value={plan?.status ?? "estimated"}
            >
              <option value="estimated">Estimated</option>
              <option value="booked">Booked</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 p-5">
          {entries.length ? entries.map((entry) => (
            <LabourEntryCard
              deleteEntry={deleteEntry}
              entry={entry}
              key={entry.id}
              people={people}
              rates={rates}
              saveEntry={saveEntry}
              updateLocal={updateLocal}
            />
          )) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-black/10 p-5 text-sm text-[var(--muted)]">
              No labour rows yet. Add a roofer, labourer, foreman or subcontractor to build the job estimate.
            </div>
          )}
        </div>

        {(message || error) ? <p className={`border-t border-[var(--border)] p-5 text-sm ${error ? "text-[#ff9a91]" : "text-[#7ce3a6]"}`}>{error || message}</p> : null}
      </div>
    </div>
  );
}

function LabourEntryCard({
  entry,
  rates,
  people,
  updateLocal,
  saveEntry,
  deleteEntry
}: {
  entry: LabourEntryRecord;
  rates: LabourRateRecord[];
  people: LabourPersonRecord[];
  updateLocal: (entryId: string, updates: Partial<LabourEntryRecord>) => void;
  saveEntry: (entry: LabourEntryRecord, updates: Partial<LabourEntryRecord>) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
}) {
  const margin = entry.charge_total > 0 ? ((entry.charge_total - entry.estimated_cost) / entry.charge_total) * 100 : 0;

  function applyRate(rateId: string) {
    const rate = rates.find((item) => item.id === rateId);
    if (!rate) return;
    const updates = {
      labour_rate_id: rate.id,
      role_name: rate.role_name,
      unit: rate.unit,
      cost_rate: Number(rate.cost_rate || 0),
      charge_rate: Number(rate.charge_rate || 0)
    };
    updateLocal(entry.id, updates);
    void saveEntry(entry, updates);
  }

  function applyPerson(personId: string) {
    const person = people.find((item) => item.id === personId);
    const updates: Partial<LabourEntryRecord> = { person_id: personId || null };
    if (person) {
      updates.role_name = person.primary_role || entry.role_name;
      if (entry.unit === "day") {
        updates.cost_rate = Number(person.day_rate_cost ?? entry.cost_rate ?? 0);
        updates.charge_rate = Number(person.day_rate_charge ?? entry.charge_rate ?? 0);
      } else {
        updates.cost_rate = Number(person.hourly_rate_cost ?? entry.cost_rate ?? 0);
        updates.charge_rate = Number(person.hourly_rate_charge ?? entry.charge_rate ?? 0);
      }
    }
    updateLocal(entry.id, updates);
    void saveEntry(entry, updates);
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_90px_100px_90px_120px_120px]">
        <Field label="Role">
          <select className="field" onChange={(event) => applyRate(event.target.value)} value={entry.labour_rate_id ?? ""}>
            <option value="">Custom role</option>
            {rates.map((rate) => (
              <option key={rate.id} value={rate.id}>
                {rate.role_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Person">
          <select className="field" onChange={(event) => applyPerson(event.target.value)} value={entry.person_id ?? ""}>
            <option value="">Unassigned</option>
            {people.filter((person) => person.is_active !== false).map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}{person.primary_role ? ` - ${person.primary_role}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="People">
          <input className="field" onBlur={() => saveEntry(entry, { people: entry.people })} onChange={(event) => updateLocal(entry.id, { people: Number(event.target.value || 0) })} type="number" value={entry.people ?? 0} />
        </Field>
        <Field label="Duration">
          <input className="field" onBlur={() => saveEntry(entry, { duration: entry.duration })} onChange={(event) => updateLocal(entry.id, { duration: Number(event.target.value || 0) })} step="0.25" type="number" value={entry.duration ?? 0} />
        </Field>
        <Field label="Unit">
          <select
            className="field"
            onChange={(event) => {
              updateLocal(entry.id, { unit: event.target.value as LabourEntryRecord["unit"] });
              void saveEntry(entry, { unit: event.target.value as LabourEntryRecord["unit"] });
            }}
            value={entry.unit}
          >
            <option value="day">Days</option>
            <option value="hour">Hours</option>
          </select>
        </Field>
        <Field label="Cost rate">
          <input className="field" onBlur={() => saveEntry(entry, { cost_rate: entry.cost_rate })} onChange={(event) => updateLocal(entry.id, { cost_rate: Number(event.target.value || 0) })} type="number" value={entry.cost_rate ?? 0} />
        </Field>
        <Field label="Charge rate">
          <input className="field" onBlur={() => saveEntry(entry, { charge_rate: entry.charge_rate })} onChange={(event) => updateLocal(entry.id, { charge_rate: Number(event.target.value || 0) })} type="number" value={entry.charge_rate ?? 0} />
        </Field>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_140px_110px_auto] md:items-end">
        <Field label="Notes">
          <input className="field" onBlur={() => saveEntry(entry, { notes: entry.notes ?? "" })} onChange={(event) => updateLocal(entry.id, { notes: event.target.value })} placeholder="Crew notes, access, scope..." value={entry.notes ?? ""} />
        </Field>
        <SummaryMini label="Cost" value={currency(entry.estimated_cost)} />
        <SummaryMini label="Quote" value={currency(entry.charge_total)} />
        <SummaryMini label="Margin" value={`${Math.round(margin)}%`} />
        <button className="button-ghost !border-[#ef4444]/35 !px-4 !py-2 text-sm !text-[#ffb4ad]" onClick={() => deleteEntry(entry.id)} type="button">
          Delete
        </button>
      </div>
    </div>
  );
}

function recalculateEntry(entry: LabourEntryRecord): LabourEntryRecord {
  const people = Number(entry.people || 0);
  const duration = Number(entry.duration || 0);
  const estimated_cost = roundMoney(people * duration * Number(entry.cost_rate || 0));
  const charge_total = roundMoney(people * duration * Number(entry.charge_rate || 0));
  return { ...entry, estimated_cost, charge_total };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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

function SummaryMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
      <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
