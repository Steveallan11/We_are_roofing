import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { acceptQuote } from "@/lib/quotes/acceptQuote";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ quoteId: string }>;
};

/**
 * Lets staff mark a quote accepted from inside the job file — for when a
 * customer confirms verbally (phone call, on-site handshake) rather than
 * clicking accept on the public quote link.
 */
export async function POST(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    option_id?: string | null;
    selected_line_indexes?: number[];
    note?: string | null;
  };

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const actorName = auth.session.user?.email ?? "Staff";
  const result = await acceptQuote(supabase, {
    quoteId,
    optionId: body.option_id,
    selectedLineIndexes: body.selected_line_indexes,
    actorType: "user",
    actorName,
    actorId: auth.session.user?.id ?? null,
    note: body.note?.trim() || null
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, accepted_option_id: result.accepted_option_id, message: "Quote marked accepted. Job moved to Accepted." });
}
