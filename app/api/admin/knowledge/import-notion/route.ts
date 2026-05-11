import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/data";
import { importNotionBatch } from "@/lib/notion-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      cursor?: string | null;
      limit?: number;
      mode?: "quotes" | "knowledge" | "all";
    };

    if (!canPersistToSupabase()) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        next_cursor: null,
        has_more: false,
        message: "Notion import preview completed."
      });
    }

    const business = await getBusiness();
    const result = await importNotionBatch({
      businessId: business.id,
      cursor: body.cursor ?? null,
      pageSize: body.limit ?? 25,
      mode: body.mode ?? "all"
    });

    const supabase = createSupabaseAdminClient();
    if (result.historicalQuotes.length > 0) {
      const upsert = await supabase.from("historical_quotes").upsert(result.historicalQuotes, {
        onConflict: "business_id,source_record_id",
        ignoreDuplicates: false
      });
      if (upsert.error) {
        return NextResponse.json({ ok: false, error: upsert.error.message }, { status: 500 });
      }
    }

    if (result.knowledgeBase.length > 0) {
      const upsert = await supabase.from("knowledge_base").upsert(result.knowledgeBase, {
        onConflict: "business_id,title,category,source_type",
        ignoreDuplicates: false
      });
      if (upsert.error) {
        return NextResponse.json({ ok: false, error: upsert.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      imported_historical_quotes: result.historicalQuotes.length,
      imported_knowledge_base: result.knowledgeBase.length,
      imported: result.historicalQuotes.length + result.knowledgeBase.length,
      next_cursor: result.nextCursor,
      has_more: result.hasMore,
      message: `Imported ${result.historicalQuotes.length} historical quote record${result.historicalQuotes.length === 1 ? "" : "s"} and ${result.knowledgeBase.length} knowledge record${result.knowledgeBase.length === 1 ? "" : "s"} from Notion.`
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Notion import failed." },
      { status: 500 }
    );
  }
}
