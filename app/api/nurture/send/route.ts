import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/sendEmail";
import { getNurtureTemplate, getAllNurtureTemplateDays } from "@/lib/email/nurture";
import type { NurtureSequence } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseAdminClient();

    // Get all active nurture sequences not yet completed
    const { data: sequences, error: seqError } = await supabase
      .from("nurture_sequences")
      .select("*")
      .is("completed_at", null)
      .order("started_at", { ascending: true });

    if (seqError) {
      return Response.json({ error: seqError.message }, { status: 500 });
    }

    let emailsSent = 0;
    const results = [];

    for (const sequence of (sequences || []) as NurtureSequence[]) {
      // Calculate days since sequence started
      const startDate = new Date(sequence.started_at);
      const now = new Date();
      const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Get all template days
      const templateDays = await getAllNurtureTemplateDays();

      // Find the next email to send
      let nextEmailDay: number | null = null;
      for (const day of templateDays) {
        if (day > sequence.current_day && day <= daysSinceStart) {
          // Check if this email hasn't been sent yet
          const { data: sent } = await supabase
            .from("nurture_emails")
            .select("id")
            .eq("sequence_id", sequence.id)
            .eq("day_number", day)
            .maybeSingle();

          if (!sent) {
            nextEmailDay = day;
            break;
          }
        }
      }

      if (!nextEmailDay) {
        // Check if sequence is complete
        const maxDay = templateDays.length > 0 ? Math.max(...templateDays) : 0;
        if (daysSinceStart >= maxDay && sequence.current_day >= maxDay) {
          // Mark sequence as completed
          await supabase
            .from("nurture_sequences")
            .update({
              completed_at: new Date().toISOString(),
              completion_reason: "all_emails_sent"
            })
            .eq("id", sequence.id);
        }
        continue;
      }

      // Get template
      const template = await getNurtureTemplate(nextEmailDay);
      if (!template) continue;

      // Get quote and job details
      const { data: quote } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", sequence.quote_id)
        .single();

      const { data: job } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", sequence.job_id)
        .single();

      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", sequence.customer_id)
        .single();

      if (!quote || !job || !customer) {
        results.push({ sequenceId: sequence.id, status: "failed", reason: "missing_data" });
        continue;
      }

      // Generate email by replacing placeholders
      const customerName = customer.full_name || customer.first_name || "there";
      const jobTitle = job.job_title || "your project";
      const subject = template.subject
        .replace("{customer_name}", customerName)
        .replace("{job_title}", jobTitle);
      const body = template.body
        .replace("{customer_name}", customerName)
        .replace("{job_title}", jobTitle);

      // Send email
      try {
        const emailResult = await sendEmail({
          to: customer.email,
          subject,
          html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
          text: body,
          jobId: sequence.job_id,
          quoteId: sequence.quote_id,
          templateType: template.template_name,
          sequenceDay: nextEmailDay
        });

        // Record nurture email
        await supabase.from("nurture_emails").insert({
          sequence_id: sequence.id,
          quote_id: sequence.quote_id,
          job_id: sequence.job_id,
          day_number: nextEmailDay,
          template_name: template.template_name,
          subject,
          body,
          customer_email: customer.email,
          status: "sent",
          sent_at: new Date().toISOString(),
          message_id: emailResult.id
        });

        // Update sequence
        await supabase
          .from("nurture_sequences")
          .update({
            current_day: nextEmailDay,
            last_email_sent_at: new Date().toISOString()
          })
          .eq("id", sequence.id);

        emailsSent++;
        results.push({ sequenceId: sequence.id, status: "sent", day: nextEmailDay });
      } catch (err) {
        results.push({
          sequenceId: sequence.id,
          status: "failed",
          reason: err instanceof Error ? err.message : "unknown_error"
        });
      }
    }

    return Response.json({ success: true, emailsSent, results });
  } catch (error) {
    console.error("Error in nurture send endpoint:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
