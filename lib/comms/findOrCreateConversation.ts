import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatUkPhone } from "@/lib/sms/sendSMS";
import type { ConversationChannel, ConversationRecord } from "@/lib/types";

type FindConversationParams = {
  customerEmail?: string | null;
  customerPhone?: string | null;
  channel: ConversationChannel;
  subject?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
};

const BUSINESS_ID = "6f9a6dca-a747-4a20-ab87-111808577bc7";

export async function findOrCreateConversation({
  customerEmail,
  customerPhone,
  channel,
  subject,
  jobId,
  quoteId
}: FindConversationParams): Promise<ConversationRecord> {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = customerEmail?.trim().toLowerCase() || null;
  const normalizedPhone = customerPhone?.trim() ? formatUkPhone(customerPhone) : null;

  let customerId: string | null = null;

  if (normalizedEmail) {
    const { data } = await supabase.from("customers").select("id").eq("email", normalizedEmail).maybeSingle();
    customerId = data?.id ?? null;
  }

  if (!customerId && normalizedPhone) {
    const { data: customers } = await supabase.from("customers").select("id, phone, contact_person_phone");
    const match = (customers ?? []).find((customer) => {
      const phone = customer.phone ? formatUkPhone(customer.phone) : null;
      const contactPhone = customer.contact_person_phone ? formatUkPhone(customer.contact_person_phone) : null;
      return phone === normalizedPhone || contactPhone === normalizedPhone;
    });
    customerId = match?.id ?? null;
  }

  let query = supabase
    .from("conversations")
    .select("*")
    .eq("primary_channel", channel)
    .neq("status", "resolved")
    .order("last_message_at", { ascending: false })
    .limit(1);

  if (customerId) {
    query = query.eq("customer_id", customerId);
  } else if (jobId) {
    query = query.eq("job_id", jobId);
  } else if (quoteId) {
    query = query.eq("quote_id", quoteId);
  }

  const { data: existing } = await query.maybeSingle();
  if (existing) {
    return existing as ConversationRecord;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      business_id: BUSINESS_ID,
      customer_id: customerId,
      job_id: jobId || null,
      quote_id: quoteId || null,
      primary_channel: channel,
      subject: subject || `New ${channel} message`,
      last_message_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create conversation.");
  }

  return data as ConversationRecord;
}
