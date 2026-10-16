import { AppShell } from "@/components/layout/app-shell";
import { UnifiedInbox, type ComposeContact } from "@/components/comms/UnifiedInbox";
import { getConversations, getJobBundle, getJobs, getLiteratureAssets, getMessages, getMessageTemplates } from "@/lib/data";

type Props = {
  searchParams?: Promise<{ compose?: string; job?: string; completion?: string }>;
};

export default async function CommunicationsPage({ searchParams }: Props) {
  const query = searchParams ? await searchParams : undefined;
  const [conversations, jobs] = await Promise.all([getConversations(), getJobs()]);
  const firstConversation = conversations[0] ?? null;
  const [messages, templates, literature] = await Promise.all([
    firstConversation ? getMessages(firstConversation.id) : Promise.resolve([]),
    getMessageTemplates(),
    getLiteratureAssets()
  ]);
  const completionBundle = query?.completion === "1" && query.job ? await getJobBundle(query.job) : null;
  const completedVariationIds = completionBundle?.completion_details?.included_variation_ids ?? completionBundle?.variations.filter((item) => ["Accepted", "Invoiced", "Paid"].includes(item.status)).map((item) => item.id) ?? [];
  const completedVariations = completionBundle?.variations.filter((item) => completedVariationIds.includes(item.id)) ?? [];
  const completionScope = completionBundle?.completion_details?.works_summary || completionBundle?.quote?.scope_of_works || completionBundle?.survey?.recommended_works || completionBundle?.job.job_title;
  const handoverDocuments = completionBundle?.documents.filter((document) => ["job_completion_pdf", "workmanship_warranty_pdf"].includes(document.document_type)) ?? [];
  const initialComposeSubject = completionBundle ? `Completion of works · ${completionBundle.job.job_ref ?? completionBundle.job.job_title}` : undefined;
  const initialComposeBody = completionBundle
    ? `Hello ${completionBundle.customer.full_name},\n\nWe’re pleased to confirm that the roofing works at ${completionBundle.job.property_address} are complete.\n\nWorks completed\n${completionScope}${completedVariations.length ? `\n\nApproved additional work completed\n${completedVariations.map((variation) => `• ${variation.variation_ref} — ${variation.title}${variation.description ? `: ${variation.description}` : ""}`).join("\n")}` : ""}\n\n${handoverDocuments.length ? "Please find the completion and warranty documents attached." : "Completion and warranty documents can be attached once they have been generated from the job files."}\n\nKind regards,\nWe Are Roofing UK Ltd`
    : undefined;
  const contacts: ComposeContact[] = jobs.map((job) => ({
    jobId: job.id,
    jobRef: job.job_ref ?? "Job",
    jobTitle: job.job_title,
    customerName: job.customer?.full_name ?? "Unknown customer",
    email: job.customer?.email ?? null,
    phone: job.customer?.phone ?? null,
    propertyAddress: job.property_address,
    jobStatus: job.status,
    followUpDate: job.follow_up_date ?? null,
    quoteRef: job.quote?.quote_ref ?? null,
    quoteStatus: job.quote?.status ?? null,
    quoteTotal: job.quote?.total ?? null
  }));

  return (
    <AppShell
      title="Messages"
      subtitle="Start a new customer message or continue an existing conversation."
      wide
    >
      <UnifiedInbox
        contacts={contacts}
        initialComposeJobId={query?.compose === "1" ? query.job ?? null : null}
        initialComposeBody={initialComposeBody}
        initialComposeSubject={initialComposeSubject}
        initialJobDocumentIds={handoverDocuments.map((document) => document.id)}
        initialConversation={firstConversation}
        initialConversations={conversations}
        initialMessages={messages}
        templates={templates}
        literature={literature}
      />
    </AppShell>
  );
}
