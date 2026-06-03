import type { SupabaseClient } from "@supabase/supabase-js";
import { canPersistToSupabase } from "@/lib/workflows";
import type { ActivityInsert, ActivityRecord } from "./types";

/**
 * Insert an activity entry. Logs failures to the console but never throws —
 * activity logging should never break a workflow.
 *
 * Pass an admin Supabase client; this helper does not require a session.
 */
export async function createActivity(
  supabase: SupabaseClient,
  entry: ActivityInsert
): Promise<ActivityRecord | null> {
  if (!canPersistToSupabase()) return null;

  const payload = {
    business_id: entry.business_id ?? null,
    job_id: entry.job_id ?? null,
    customer_id: entry.customer_id ?? null,
    quote_id: entry.quote_id ?? null,
    invoice_id: entry.invoice_id ?? null,
    activity_type: entry.activity_type,
    message: entry.message,
    details: entry.details ?? {},
    actor_type: entry.actor_type ?? "system",
    actor_id: entry.actor_id ?? null,
    actor_name: entry.actor_name ?? null,
    linked_entity_type: entry.linked_entity_type ?? null,
    linked_entity_id: entry.linked_entity_id ?? null
  };

  const { data, error } = await supabase.from("job_activity").insert(payload).select("*").single();
  if (error) {
    console.warn("createActivity failed:", error.message, { activity_type: entry.activity_type, job_id: entry.job_id });
    return null;
  }
  return data as ActivityRecord;
}

/** List activity for a job, newest first. Returns [] on missing table / failure. */
export async function listJobActivity(
  supabase: SupabaseClient,
  jobId: string,
  limit = 50
): Promise<ActivityRecord[]> {
  if (!canPersistToSupabase()) return [];
  const { data, error } = await supabase
    .from("job_activity")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("listJobActivity failed:", error.message);
    return [];
  }
  return (data ?? []) as ActivityRecord[];
}
