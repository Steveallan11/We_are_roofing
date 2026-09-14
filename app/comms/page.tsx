import { AppShell } from "@/components/layout/app-shell";
import { UnifiedInbox, type ComposeContact } from "@/components/comms/UnifiedInbox";
import { getConversations, getJobs, getMessages, getMessageTemplates } from "@/lib/data";

type Props = {
  searchParams?: Promise<{ compose?: string; job?: string }>;
};

export default async function CommunicationsPage({ searchParams }: Props) {
  const query = searchParams ? await searchParams : undefined;
  const [conversations, jobs] = await Promise.all([getConversations(), getJobs()]);
  const firstConversation = conversations[0] ?? null;
  const [messages, templates] = await Promise.all([
    firstConversation ? getMessages(firstConversation.id) : Promise.resolve([]),
    getMessageTemplates()
  ]);
  const contacts: ComposeContact[] = jobs.map((job) => ({
    jobId: job.id,
    jobRef: job.job_ref ?? "Job",
    jobTitle: job.job_title,
    customerName: job.customer?.full_name ?? "Unknown customer",
    email: job.customer?.email ?? null,
    phone: job.customer?.phone ?? null
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
        initialConversation={firstConversation}
        initialConversations={conversations}
        initialMessages={messages}
        templates={templates}
      />
    </AppShell>
  );
}
