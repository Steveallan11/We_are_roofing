import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { startNurtureSequence } from "@/lib/email/nurture";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action: "start" | "cancel";
      quoteId?: string;
    };

    const { action, quoteId } = body;

    if (!quoteId) {
      return Response.json({ error: "Missing quoteId" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (action === "start") {
      // Manually start nurture sequence for an existing quote
      const sequence = await startNurtureSequence(quoteId);

      if (!sequence) {
        return Response.json(
          { error: "Could not start sequence. It may already exist." },
          { status: 400 }
        );
      }

      return Response.json({
        success: true,
        message: "Nurture sequence started",
        sequence
      });
    }

    if (action === "cancel") {
      // Cancel active nurture sequence
      const { data: sequence, error: fetchError } = await supabase
        .from("nurture_sequences")
        .select("*")
        .eq("quote_id", quoteId)
        .is("completed_at", null)
        .maybeSingle();

      if (fetchError || !sequence) {
        return Response.json(
          { error: "No active sequence found for this quote" },
          { status: 404 }
        );
      }

      const { error: updateError } = await supabase
        .from("nurture_sequences")
        .update({
          completed_at: new Date().toISOString(),
          completion_reason: "manually_cancelled"
        })
        .eq("id", sequence.id);

      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }

      return Response.json({
        success: true,
        message: "Nurture sequence cancelled"
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in nurture manage endpoint:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
