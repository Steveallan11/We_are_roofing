import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type RescheduleBody = {
  eventId: string;
  eventKind: "survey" | "booking" | "works" | "follow-up";
  newDate: string;
  jobId?: string;
};

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RescheduleBody;

  if (!body.eventId || !body.eventKind || !body.newDate) {
    return NextResponse.json(
      { ok: false, error: "eventId, eventKind, and newDate are required." },
      { status: 400 }
    );
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Event rescheduled in preview mode." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();

  try {
    if (body.eventKind === "booking" || body.eventKind === "survey") {
      const { error } = await supabase
        .from("bookings")
        .update({ date: body.newDate, updated_at: new Date().toISOString() })
        .eq("id", body.eventId);

      if (error) throw error;
    } else if (body.eventKind === "works") {
      if (!body.jobId) {
        return NextResponse.json({ ok: false, error: "jobId is required for works events." }, { status: 400 });
      }

      const { error } = await supabase
        .from("jobs")
        .update({ start_date: body.newDate, updated_at: new Date().toISOString() })
        .eq("id", body.jobId);

      if (error) throw error;
    } else if (body.eventKind === "follow-up") {
      if (!body.jobId) {
        return NextResponse.json({ ok: false, error: "jobId is required for follow-up events." }, { status: 400 });
      }

      const { error } = await supabase
        .from("jobs")
        .update({ follow_up_date: body.newDate, updated_at: new Date().toISOString() })
        .eq("id", body.jobId);

      if (error) throw error;
    }

    return NextResponse.json({ ok: true, message: "Event rescheduled successfully." });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to reschedule event." },
      { status: 500 }
    );
  }
}
