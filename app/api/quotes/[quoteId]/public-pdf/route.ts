import { NextResponse } from "next/server";
import { validatePublicQuoteAccess } from "@/lib/public-quote";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getJobBundle } from "@/lib/data";
import { persistQuoteArtifacts } from "@/lib/quote-engine";
import { canPersistToSupabase } from "@/lib/workflows";
import type { QuoteRecord } from "@/lib/types";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function GET(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  const supabase = createSupabaseAdminClient();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const record = quote as QuoteRecord;
  const access = validatePublicQuoteAccess(record, token ?? undefined);
  if (!access.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ error: "PDF generation not available in preview mode" }, { status: 400 });
  }

  const bundle = await getJobBundle(record.job_id);
  if (!bundle) {
    return NextResponse.json({ error: "Related job not found" }, { status: 404 });
  }

  const artifacts = await persistQuoteArtifacts(supabase, { ...bundle, quote: record }, record);

  if (!artifacts.pdfUrl) {
    return NextResponse.json(
      { error: artifacts.pdfError || "Failed to generate PDF" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(artifacts.pdfUrl);
}
