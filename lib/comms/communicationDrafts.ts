import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findOrCreateConversation } from "@/lib/comms/findOrCreateConversation";
import { assertEmailAttachmentLimit, loadJobDocumentAttachments, loadLiteratureAttachments } from "@/lib/comms/literatureAttachments";
import { sendMessage } from "@/lib/comms/sendMessage";
import type { CommunicationDraft, ConversationChannel, JobDocumentRecord, LiteratureAsset } from "@/lib/types";

type SaveDraftInput = {
  id?: string | null;
  conversationId: string;
  channel: Extract<ConversationChannel, "email" | "sms" | "whatsapp">;
  subject?: string | null;
  body: string;
  literatureIds?: string[];
  jobDocumentIds?: string[];
  createdBy?: string;
};

export async function saveCommunicationDraft(input: SaveDraftInput): Promise<CommunicationDraft> {
  const supabase = createSupabaseAdminClient();
  const body = input.body.trim();
  if (!body) throw new Error("The draft message is empty.");
  if (input.channel !== "email" && ((input.literatureIds?.length ?? 0) > 0 || (input.jobDocumentIds?.length ?? 0) > 0)) {
    throw new Error("Files can only be attached to email drafts.");
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, business_id, customer_id, job_id")
    .eq("id", input.conversationId)
    .single();
  if (conversationError || !conversation?.business_id) {
    throw new Error(conversationError?.message ?? "Conversation not found.");
  }

  const literatureIds = [...new Set(input.literatureIds ?? [])].slice(0, 10);
  if (literatureIds.length) {
    const { data, error } = await supabase.from("literature_assets").select("id").in("id", literatureIds).eq("business_id", conversation.business_id).eq("is_active", true);
    if (error || (data ?? []).length !== literatureIds.length) throw new Error("One or more selected literature files are unavailable.");
  }
  const jobDocumentIds = [...new Set(input.jobDocumentIds ?? [])].slice(0, 20);
  if (jobDocumentIds.length) {
    if (!conversation.job_id) throw new Error("Job documents can only be attached to a job-linked conversation.");
    const { data, error } = await supabase.from("job_documents").select("id, file_size, storage_bucket, storage_path, content_html").eq("job_id", conversation.job_id).in("id", jobDocumentIds);
    if (error || (data ?? []).length !== jobDocumentIds.length) throw new Error("One or more selected job documents are unavailable on this job.");
    if ((data ?? []).some((item) => !(item.storage_bucket && item.storage_path) && !item.content_html)) {
      throw new Error("One or more selected job documents do not have a stored file to attach.");
    }
  }

  const payload = {
    business_id: conversation.business_id,
    conversation_id: conversation.id,
    customer_id: conversation.customer_id,
    job_id: conversation.job_id,
    channel: input.channel,
    subject: input.channel === "email" ? input.subject?.trim() || null : null,
    body,
    literature_ids: literatureIds,
    job_document_ids: jobDocumentIds,
    status: "draft",
    created_by: input.createdBy || "admin"
  };

  const query = input.id
    ? supabase.from("communication_drafts").update(payload).eq("id", input.id).eq("status", "draft")
    : supabase.from("communication_drafts").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Unable to save the communication draft.");
  return data as CommunicationDraft;
}

export async function getLatestConversationDraft(conversationId: string): Promise<CommunicationDraft | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("communication_drafts")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CommunicationDraft | null) ?? null;
}

export async function getCommunicationDraft(draftId: string, expectedBusinessId?: string): Promise<CommunicationDraft> {
  let query = createSupabaseAdminClient()
    .from("communication_drafts")
    .select("*")
    .eq("id", draftId);
  if (expectedBusinessId) query = query.eq("business_id", expectedBusinessId);
  const { data, error } = await query.single();
  if (error || !data) throw new Error(error?.message ?? "Communication draft not found.");
  return data as CommunicationDraft;
}

export async function createJobEmailDraft(input: {
  jobRef: string;
  subject: string;
  body: string;
  literatureNames?: string[];
  jobDocumentIds?: string[];
  businessId: string;
  createdBy?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, business_id, customer_id, job_ref, job_title, customers(full_name, email, contact_person_email, phone, contact_person_phone)")
    .eq("business_id", input.businessId)
    .eq("job_ref", input.jobRef)
    .single();
  if (error || !job) throw new Error(error?.message ?? `Job ${input.jobRef} was not found.`);

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const email = customer?.email || customer?.contact_person_email || null;
  if (!email) throw new Error(`${input.jobRef} does not have a customer email address.`);

  const conversation = await findOrCreateConversation({
    customerEmail: email,
    customerPhone: customer?.phone || customer?.contact_person_phone || null,
    channel: "email",
    subject: input.subject,
    jobId: job.id
  });

  const requestedNames = [...new Set(input.literatureNames ?? [])];
  let literature: LiteratureAsset[] = [];
  if (requestedNames.length) {
    const { data, error: literatureError } = await supabase
      .from("literature_assets")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("is_active", true);
    if (literatureError) throw new Error(literatureError.message);
    const available = (data ?? []) as LiteratureAsset[];
    literature = requestedNames.map((name) => {
      const match = available.find((item) => item.display_name.toLowerCase() === name.toLowerCase());
      if (!match) throw new Error(`Literature file "${name}" was not found. Use list_literature first.`);
      return match;
    });
  }

  const requestedDocumentIds = [...new Set(input.jobDocumentIds ?? [])].slice(0, 20);
  let jobDocuments: JobDocumentRecord[] = [];
  if (requestedDocumentIds.length) {
    const { data, error: documentError } = await supabase
      .from("job_documents")
      .select("*")
      .eq("job_id", job.id)
      .in("id", requestedDocumentIds);
    if (documentError) throw new Error(documentError.message);
    jobDocuments = (data ?? []) as JobDocumentRecord[];
    if (jobDocuments.length !== requestedDocumentIds.length) throw new Error("One or more selected documents were not found on this job. Use list_job_documents first.");
  }

  const draft = await saveCommunicationDraft({
    conversationId: conversation.id,
    channel: "email",
    subject: input.subject,
    body: input.body,
    literatureIds: literature.map((item) => item.id),
    jobDocumentIds: jobDocuments.map((item) => item.id),
    createdBy: input.createdBy || "chatgpt"
  });

  return {
    draft,
    preview: {
      to: email,
      customer_name: customer?.full_name ?? "Customer",
      job_ref: job.job_ref,
      subject: draft.subject,
      body: draft.body,
      attachments: [...jobDocuments.map((item) => item.display_name), ...literature.map((item) => item.display_name)]
    }
  };
}

export async function sendCommunicationDraft(draftId: string, confirmed: boolean, expectedBusinessId?: string) {
  if (!confirmed) throw new Error("Explicit confirmation is required before sending.");
  const supabase = createSupabaseAdminClient();
  let claim = supabase
    .from("communication_drafts")
    .update({ status: "sending" })
    .eq("id", draftId)
    .eq("status", "draft");
  if (expectedBusinessId) claim = claim.eq("business_id", expectedBusinessId);
  const { data: claimedDraft, error: claimError } = await claim.select("*").maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimedDraft) {
    const current = await getCommunicationDraft(draftId, expectedBusinessId).catch(() => null);
    throw new Error(current ? `This communication is already ${current.status}.` : "Communication draft not found.");
  }

  try {
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("*, customers(*)")
      .eq("id", claimedDraft.conversation_id)
      .single();
    if (conversationError || !conversation) throw new Error(conversationError?.message ?? "The draft conversation no longer exists.");
    const customer = Array.isArray(conversation.customers) ? conversation.customers[0] : conversation.customers;
    const attachments = claimedDraft.channel === "email"
      ? [
          ...(claimedDraft.job_document_ids?.length
            ? await loadJobDocumentAttachments(supabase, claimedDraft.job_document_ids, claimedDraft.job_id, claimedDraft.business_id)
            : []),
          ...await loadLiteratureAttachments(supabase, claimedDraft.literature_ids ?? [], claimedDraft.business_id)
        ]
      : [];
    assertEmailAttachmentLimit(attachments);

    const result = await sendMessage({
      conversationId: conversation.id,
      channel: claimedDraft.channel,
      body: claimedDraft.body,
      subject: claimedDraft.subject,
      toEmail: customer?.email || customer?.contact_person_email || null,
      toPhone: customer?.phone || customer?.contact_person_phone || null,
      jobId: conversation.job_id,
      quoteId: conversation.quote_id,
      templateType: "communication_draft",
      attachments
    });

    const { error: updateError } = await supabase
      .from("communication_drafts")
      .update({ status: "sent", sent_at: new Date().toISOString(), sent_message_id: result.messageId })
      .eq("id", claimedDraft.id)
      .eq("status", "sending");
    if (updateError) throw new Error(`Message was sent, but the draft status could not be updated: ${updateError.message}`);

    return { ...result, draftId: claimedDraft.id, attachments: attachments.map((item) => item.filename) };
  } catch (error) {
    await supabase.from("communication_drafts").update({ status: "failed" }).eq("id", claimedDraft.id).eq("status", "sending");
    throw error;
  }
}
