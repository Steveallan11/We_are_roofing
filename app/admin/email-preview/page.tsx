import { requireAdminSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { EmailPreviewGallery } from "@/components/settings/EmailPreviewGallery";
import { emailPreviews } from "@/lib/email/previews";
export const dynamic = "force-dynamic";
export default async function EmailPreviewPage() {
  await requireAdminSession("/admin/email-preview");
  return <AppShell title="Email previews" subtitle="Review our customer email templates on desktop and mobile."><EmailPreviewGallery previews={emailPreviews()} /></AppShell>;
}
