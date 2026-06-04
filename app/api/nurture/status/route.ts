import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const quoteId = searchParams.get("quoteId");

    if (!quoteId) {
      return Response.json({ error: "Missing quoteId" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Get nurture sequence
    const { data: sequence, error: seqError } = await supabase
      .from("nurture_sequences")
      .select("*")
      .eq("quote_id", quoteId)
      .maybeSingle();

    if (seqError) {
      return Response.json({ error: seqError.message }, { status: 500 });
    }

    if (!sequence) {
      return Response.json({ sequence: null, emails: [] });
    }

    // Get all emails for this sequence
    const { data: emails, error: emailError } = await supabase
      .from("nurture_emails")
      .select("*")
      .eq("sequence_id", sequence.id)
      .order("day_number", { ascending: true });

    if (emailError) {
      return Response.json({ error: emailError.message }, { status: 500 });
    }

    return Response.json({ sequence, emails: emails || [] });
  } catch (error) {
    console.error("Error in nurture status endpoint:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
