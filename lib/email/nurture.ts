import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NurtureSequence } from "@/lib/types";

// Default nurture email sequence templates
const DEFAULT_NURTURE_TEMPLATES = [
  {
    day: 3,
    templateName: "follow_up_3days",
    subject: "Checking in on your quote – Any questions?",
    bodyTemplate: (customerName: string, jobTitle: string) =>
      `Hi ${customerName},

I hope you've had a chance to review the quote for ${jobTitle}.

If you have any questions or need clarification on anything, I'm here to help. Just give me a call or reply to this email.

Looking forward to working with you!

Best regards,
Andy @ We Are Roofing`
  },
  {
    day: 7,
    templateName: "follow_up_7days",
    subject: "Following up on your ${jobTitle} quote",
    bodyTemplate: (customerName: string, jobTitle: string) =>
      `Hi ${customerName},

Following up on the quote we sent a few days ago for ${jobTitle}.

Would love to get this moving forward. Let me know if you'd like to proceed or if there's anything I can help clarify.

Thanks!
Andy`
  },
  {
    day: 14,
    templateName: "follow_up_14days",
    subject: "Last reminder: Your roof quote is still valid",
    bodyTemplate: (customerName: string, jobTitle: string) =>
      `Hi ${customerName},

Just a friendly reminder that the quote for ${jobTitle} is still valid and available.

If you're ready to move forward or have any final questions, I'm happy to help. Otherwise, feel free to reach out if your timeline changes and you'd like to revisit the project.

Best regards,
Andy @ We Are Roofing`
  }
];

export async function startNurtureSequence(quoteId: string): Promise<NurtureSequence | null> {
  const supabase = createSupabaseAdminClient();

  // Get quote and job details
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, job_id, customer_email_subject")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) {
    console.error("Failed to fetch quote for nurture sequence:", quoteError);
    return null;
  }

  // Get job and customer details
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_title, customer_id")
    .eq("id", quote.job_id)
    .single();

  if (jobError || !job) {
    console.error("Failed to fetch job for nurture sequence:", jobError);
    return null;
  }

  // Check if sequence already exists
  const { data: existing } = await supabase
    .from("nurture_sequences")
    .select("id")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (existing) {
    // Sequence already started
    return null;
  }

  // Create nurture sequence
  const { data: sequence, error: seqError } = await supabase
    .from("nurture_sequences")
    .insert({
      quote_id: quoteId,
      job_id: quote.job_id,
      customer_id: job.customer_id
    })
    .select("*")
    .single();

  if (seqError || !sequence) {
    console.error("Failed to create nurture sequence:", seqError);
    return null;
  }

  return sequence as NurtureSequence;
}

export async function getNurtureSequence(quoteId: string): Promise<NurtureSequence | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("nurture_sequences")
    .select("*")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch nurture sequence:", error);
    return null;
  }

  return data as NurtureSequence | null;
}

export function getNurtureTemplate(dayNumber: number) {
  return DEFAULT_NURTURE_TEMPLATES.find((t) => t.day === dayNumber);
}

export function getAllNurtureTemplateDays() {
  return DEFAULT_NURTURE_TEMPLATES.map((t) => t.day).sort((a, b) => a - b);
}
