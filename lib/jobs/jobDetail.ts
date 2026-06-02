import type { JobDocumentRecord } from "@/lib/types";
import { getJobDocumentHref } from "@/lib/documents";

export type DocumentGroupKey = "Survey" | "Quotes" | "Invoices" | "Uploads";

export function groupDocuments(documents: JobDocumentRecord[]): Record<DocumentGroupKey, JobDocumentRecord[]> {
  return {
    Survey: documents.filter((document) => document.document_type.includes("survey")),
    Quotes: documents.filter((document) => document.document_type.includes("quote")),
    Invoices: documents.filter((document) => document.document_type.includes("invoice")),
    Uploads: documents.filter(
      (document) =>
        !document.document_type.includes("survey") &&
        !document.document_type.includes("quote") &&
        !document.document_type.includes("invoice")
    )
  };
}

export function getDocumentDisplayType(document: JobDocumentRecord) {
  if (document.document_type === "survey_snapshot") return "Survey snapshot";
  if (document.document_type === "quote_html") return "Quote HTML snapshot";
  if (document.document_type === "quote_pdf") return "Quote PDF";
  if (document.document_type === "invoice_pdf") return "Invoice PDF";
  if (document.document_type === "invoice_html") return "Invoice HTML snapshot";
  return document.document_type;
}

export function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function summarizeMaterials(materials: Array<{ required_status?: string | null }>) {
  const counts = materials.reduce<Record<string, number>>((summary, material) => {
    const status = material.required_status || "TBC";
    summary[status] = (summary[status] ?? 0) + 1;
    return summary;
  }, {});

  return Object.entries(counts)
    .slice(0, 3)
    .map(([status, count]) => `${count} ${status}`)
    .join(" | ");
}

export type ActivityFeedItem = {
  type: "workflow" | "document" | "email";
  badge: string;
  label: string;
  detail: string | null;
  date: string | null | undefined;
  href?: string;
};

export function buildActivityFeed({
  events,
  documents,
  emailLogs,
  jobId
}: {
  events: Array<{ label: string; detail: string | null; date: string | null | undefined }>;
  documents: JobDocumentRecord[];
  emailLogs: Array<{
    subject: string;
    status: string;
    sent_at?: string | null;
    quote_id?: string | null;
    to_email?: string | null;
  }>;
  jobId: string;
}): ActivityFeedItem[] {
  const workflowItems: ActivityFeedItem[] = events.map((event) => ({
    type: "workflow",
    badge: "Workflow",
    label: event.label,
    detail: event.detail,
    date: event.date
  }));

  const documentItems: ActivityFeedItem[] = documents.slice(0, 6).map((document) => ({
    type: "document",
    badge: "Document",
    label: document.display_name,
    detail: getDocumentDisplayType(document),
    date: document.created_at,
    href: getJobDocumentHref(document)
  }));

  const emailItems: ActivityFeedItem[] = emailLogs.slice(0, 6).map((item) => ({
    type: "email",
    badge: "Email",
    label: item.subject,
    detail: [item.status, item.to_email].filter(Boolean).join(" | ") || null,
    date: item.sent_at,
    href: item.quote_id ? `/jobs/${jobId}/quote/preview` : undefined
  }));

  return [...workflowItems, ...documentItems, ...emailItems]
    .filter((item) => item.date || item.detail)
    .sort((left, right) => new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime())
    .slice(0, 10);
}

export function getActivityDotClass(type: ActivityFeedItem["type"]) {
  if (type === "document") return "bg-[#3b82f6]";
  if (type === "email") return "bg-[#10b981]";
  return "bg-[var(--gold)]";
}
