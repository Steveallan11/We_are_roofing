import { AppShell } from "@/components/layout/app-shell";
import { UnifiedInbox } from "@/components/comms/UnifiedInbox";
import { getConversations, getMessages, getMessageTemplates } from "@/lib/data";

export default async function CommunicationsPage() {
  const conversations = await getConversations();
  const firstConversation = conversations[0] ?? null;
  const [messages, templates] = await Promise.all([
    firstConversation ? getMessages(firstConversation.id) : Promise.resolve([]),
    getMessageTemplates()
  ]);

  return (
    <AppShell
      title="Communications"
      subtitle="Keep customer email, SMS, WhatsApp, and platform replies together in one view so nothing slips through the cracks."
      wide
    >
      <UnifiedInbox initialConversation={firstConversation} initialConversations={conversations} initialMessages={messages} templates={templates} />
    </AppShell>
  );
}
