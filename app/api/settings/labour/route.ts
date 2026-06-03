import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getBusiness } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type RateInput = {
  role_name?: string;
  cost_rate?: number | string;
  charge_rate?: number | string;
  unit?: "hour" | "day";
  default_margin_pct?: number | string | null;
  active?: boolean;
  notes?: string | null;
};

type PersonInput = {
  id?: string;
  full_name?: string;
  worker_type?: "staff" | "subcontractor" | "agency" | "other";
  primary_role?: string | null;
  phone?: string | null;
  email?: string | null;
  company_name?: string | null;
  day_rate_cost?: number | string | null;
  day_rate_charge?: number | string | null;
  hourly_rate_cost?: number | string | null;
  hourly_rate_charge?: number | string | null;
  skills?: string[] | string | null;
  emergency_contact?: string | null;
  insurance_notes?: string | null;
  is_active?: boolean;
  notes?: string | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rates = Array.isArray(body.rates) ? (body.rates as RateInput[]) : [];
  const people = Array.isArray(body.people) ? (body.people as PersonInput[]) : [];

  if (!canPersistToSupabase()) return NextResponse.json({ ok: true, savedRates: rates.length, savedPeople: people.length });

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();

  const rateRows = rates
    .map((rate) => ({
      business_id: business.id,
      role_name: String(rate.role_name || "").trim(),
      cost_rate: Number(rate.cost_rate || 0),
      charge_rate: Number(rate.charge_rate || 0),
      unit: rate.unit === "hour" ? "hour" : "day",
      default_margin_pct: rate.default_margin_pct == null || rate.default_margin_pct === "" ? null : Number(rate.default_margin_pct || 0),
      active: rate.active !== false,
      notes: rate.notes || null,
      updated_at: new Date().toISOString()
    }))
    .filter((rate) => rate.role_name);

  const peopleRows = people
    .map((person) => ({
      id: person.id,
      business_id: business.id,
      full_name: String(person.full_name || "").trim(),
      worker_type: person.worker_type || "staff",
      primary_role: person.primary_role || null,
      phone: person.phone || null,
      email: person.email || null,
      company_name: person.company_name || null,
      day_rate_cost: toNullableNumber(person.day_rate_cost),
      day_rate_charge: toNullableNumber(person.day_rate_charge),
      hourly_rate_cost: toNullableNumber(person.hourly_rate_cost),
      hourly_rate_charge: toNullableNumber(person.hourly_rate_charge),
      skills: Array.isArray(person.skills) ? person.skills : String(person.skills || "").split(",").map((item) => item.trim()).filter(Boolean),
      emergency_contact: person.emergency_contact || null,
      insurance_notes: person.insurance_notes || null,
      is_active: person.is_active !== false,
      notes: person.notes || null,
      updated_at: new Date().toISOString()
    }))
    .filter((person) => person.full_name);

  const { error: deleteRatesError } = await supabase.from("labour_rates").delete().eq("business_id", business.id);
  if (deleteRatesError) return NextResponse.json({ ok: false, error: deleteRatesError.message }, { status: 500 });

  const ratesResult = rateRows.length ? await supabase.from("labour_rates").insert(rateRows).select("*") : { data: [], error: null };

  if (ratesResult.error) return NextResponse.json({ ok: false, error: ratesResult.error.message }, { status: 500 });

  const savedPeople = [];
  for (const person of peopleRows) {
    const { id, ...payload } = person;
    const result = id
      ? await supabase.from("labour_people").update(payload).eq("id", id).eq("business_id", business.id).select("*").single()
      : await supabase.from("labour_people").insert(payload).select("*").single();

    if (result.error) return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
    if (result.data) savedPeople.push(result.data);
  }

  return NextResponse.json({
    ok: true,
    savedRates: ratesResult.data?.length ?? 0,
    savedPeople: savedPeople.length,
    rates: ratesResult.data ?? [],
    people: savedPeople
  });
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return Number(value || 0);
}
