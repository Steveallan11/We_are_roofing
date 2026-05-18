import { NextResponse } from "next/server";
import { syncAllHistoricalQuotesToKnowledgeBase } from "@/lib/knowledge-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, synced: 0, total: 0 });
  }

  try {
    const result = await syncAllHistoricalQuotesToKnowledgeBase(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Knowledge sync failed." },
      { status: 500 }
    );
  }
}
