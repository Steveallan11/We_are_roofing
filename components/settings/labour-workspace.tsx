"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { LabourPersonRecord, LabourRateRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

type Props = {
  initialRates: LabourRateRecord[];
  initialPeople: LabourPersonRecord[];
};

const DEFAULT_RATE: LabourRateRecord = {
  id: "new-rate",
  business_id: "",
  role_name: "New role",
  cost_rate: 0,
  charge_rate: 0,
  unit: "day",
  default_margin_pct: null,
  active: true,
  notes: ""
};

const DEFAULT_PERSON: LabourPersonRecord = {
  id: "new-person",
  business_id: "",
  full_name: "",
  worker_type: "staff",
  primary_role: "",
  phone: "",
  email: "",
  company_name: "",
  day_rate_cost: null,
  day_rate_charge: null,
  hourly_rate_cost: null,
  hourly_rate_charge: null,
  skills: [],
  emergency_contact: "",
  insurance_notes: "",
  is_active: true,
  notes: ""
};

export function LabourWorkspace({ initialRates, initialPeople }: Props) {
  const router = useRouter();
  const [rates, setRates] = useState(initialRates.length ? initialRates : seedRates());
  const [people, setPeople] = useState(initialPeople);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateRate(index: number, updates: Partial<LabourRateRecord>) {
    setRates((current) => current.map((rate, rateIndex) => (rateIndex === index ? { ...rate, ...updates } : rate)));
  }

  function updatePerson(index: number, updates: Partial<LabourPersonRecord>) {
    setPeople((current) => current.map((person, personIndex) => (personIndex === index ? { ...person, ...updates } : person)));
  }

  async function save() {
    setMessage(null);
    setError(null);
    const response = await fetch("/api/settings/labour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rates: rates.filter((rate) => rate.role_name.trim()),
        people: people.filter((person) => person.full_name.trim())
      })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; rates?: LabourRateRecord[]; people?: LabourPersonRecord[] } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Labour settings could not be saved.");
      return;
    }
    if (result.rates) setRates(result.rates);
    if (result.people) setPeople(result.people);
    setMessage("Labour rates and crew profiles saved.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack">
      {(message || error) ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ff9a91]" : "border-[#10b981]/30 bg-[#10b981]/10 text-[#7ce3a6]"}`}>
          {error || message}
        </div>
      ) : null}

      <div className="card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Labour Rate Card</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">Charge-out and real labour cost</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Cost rate stays internal. Charge rate is what gets pulled into quotes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => setRates((current) => [...current, { ...DEFAULT_RATE, id: `new-rate-${Date.now()}` }])} type="button">
              + Add Role
            </button>
            <button className="button-primary" disabled={isPending} onClick={save} type="button">
              {isPending ? "Saving..." : "Save Labour"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {rates.map((rate, index) => {
            const margin = Number(rate.charge_rate || 0) > 0 ? ((Number(rate.charge_rate || 0) - Number(rate.cost_rate || 0)) / Number(rate.charge_rate || 0)) * 100 : 0;
            return (
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4" key={rate.id || index}>
                <div className="grid gap-3 md:grid-cols-[1fr_110px_130px_130px_110px_auto] md:items-end">
                  <Field label="Role">
                    <input className="field" onChange={(event) => updateRate(index, { role_name: event.target.value })} value={rate.role_name} />
                  </Field>
                  <Field label="Unit">
                    <select className="field" onChange={(event) => updateRate(index, { unit: event.target.value as LabourRateRecord["unit"] })} value={rate.unit}>
                      <option value="day">Day</option>
                      <option value="hour">Hour</option>
                    </select>
                  </Field>
                  <Field label="Cost rate">
                    <input className="field" inputMode="decimal" onChange={(event) => updateRate(index, { cost_rate: Number(event.target.value || 0) })} type="number" value={rate.cost_rate ?? 0} />
                  </Field>
                  <Field label="Charge rate">
                    <input className="field" inputMode="decimal" onChange={(event) => updateRate(index, { charge_rate: Number(event.target.value || 0) })} type="number" value={rate.charge_rate ?? 0} />
                  </Field>
                  <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 p-3">
                    <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Margin</p>
                    <p className="mt-1 font-semibold text-white">{Math.round(margin)}%</p>
                  </div>
                  <button className="button-ghost !border-[#ef4444]/30 !px-3 !py-2 text-xs text-[#ff9a91]" onClick={() => setRates((current) => current.filter((_, i) => i !== index))} type="button">
                    Remove
                  </button>
                </div>
                <textarea className="field mt-3 min-h-16" onChange={(event) => updateRate(index, { notes: event.target.value })} placeholder="Notes for this labour role..." value={rate.notes ?? ""} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">People / Crew Profiles</p>
            <h2 className="mt-2 font-condensed text-3xl text-white">Who can be assigned to jobs</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Store staff, subcontractors, contact details, rates, skills, and insurance notes.</p>
          </div>
          <button className="button-secondary" onClick={() => setPeople((current) => [...current, { ...DEFAULT_PERSON, id: `new-person-${Date.now()}` }])} type="button">
            + Add Person
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          {people.length ? people.map((person, index) => (
            <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4" key={person.id || index}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Name">
                  <input className="field" onChange={(event) => updatePerson(index, { full_name: event.target.value })} value={person.full_name} />
                </Field>
                <Field label="Type">
                  <select className="field" onChange={(event) => updatePerson(index, { worker_type: event.target.value as LabourPersonRecord["worker_type"] })} value={person.worker_type}>
                    <option value="staff">Staff</option>
                    <option value="subcontractor">Subcontractor</option>
                    <option value="agency">Agency</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Primary role">
                  <input className="field" onChange={(event) => updatePerson(index, { primary_role: event.target.value })} value={person.primary_role ?? ""} />
                </Field>
                <Field label="Company">
                  <input className="field" onChange={(event) => updatePerson(index, { company_name: event.target.value })} value={person.company_name ?? ""} />
                </Field>
                <Field label="Phone">
                  <input className="field" onChange={(event) => updatePerson(index, { phone: event.target.value })} type="tel" value={person.phone ?? ""} />
                </Field>
                <Field label="Email">
                  <input className="field" onChange={(event) => updatePerson(index, { email: event.target.value })} type="email" value={person.email ?? ""} />
                </Field>
                <Field label="Day cost">
                  <input className="field" onChange={(event) => updatePerson(index, { day_rate_cost: Number(event.target.value || 0) })} type="number" value={person.day_rate_cost ?? ""} />
                </Field>
                <Field label="Day charge">
                  <input className="field" onChange={(event) => updatePerson(index, { day_rate_charge: Number(event.target.value || 0) })} type="number" value={person.day_rate_charge ?? ""} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Skills">
                  <input className="field" onChange={(event) => updatePerson(index, { skills: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Tile, EPDM, leadwork" value={(person.skills ?? []).join(", ")} />
                </Field>
                <Field label="Emergency contact">
                  <input className="field" onChange={(event) => updatePerson(index, { emergency_contact: event.target.value })} value={person.emergency_contact ?? ""} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <textarea className="field min-h-20" onChange={(event) => updatePerson(index, { insurance_notes: event.target.value })} placeholder="Insurance, CIS, subcontractor paperwork..." value={person.insurance_notes ?? ""} />
                <textarea className="field min-h-20" onChange={(event) => updatePerson(index, { notes: event.target.value })} placeholder="General notes..." value={person.notes ?? ""} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--muted)]">
                  Quote day rate: <span className="font-semibold text-[var(--gold-l)]">{currency(Number(person.day_rate_charge || 0))}</span>
                </p>
                <button
                  className="button-ghost !border-[#ef4444]/30 !px-3 !py-2 text-xs text-[#ff9a91]"
                  onClick={() =>
                    setPeople((current) =>
                      person.id.startsWith("new-person")
                        ? current.filter((_, i) => i !== index)
                        : current.map((item, i) => (i === index ? { ...item, is_active: false } : item))
                    )
                  }
                  type="button"
                >
                  {person.id.startsWith("new-person") ? "Remove profile" : person.is_active === false ? "Inactive" : "Deactivate"}
                </button>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">
              No crew profiles yet. Add Andy, roofers, labourers, and subcontractors here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function seedRates(): LabourRateRecord[] {
  return [
    { ...DEFAULT_RATE, id: "seed-roofer", role_name: "Roofer", cost_rate: 220, charge_rate: 320, unit: "day", notes: "Standard experienced roofer day rate." },
    { ...DEFAULT_RATE, id: "seed-labourer", role_name: "Labourer", cost_rate: 150, charge_rate: 240, unit: "day", notes: "General labour and site support." },
    { ...DEFAULT_RATE, id: "seed-foreman", role_name: "Foreman / Lead Roofer", cost_rate: 260, charge_rate: 380, unit: "day", notes: "Lead roofer or site supervisor." }
  ];
}
