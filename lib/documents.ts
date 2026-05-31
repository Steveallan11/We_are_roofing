import type { JobDocumentRecord } from "@/lib/types";

export function getDocumentFileHref(documentId: string) {
  return `/api/documents/${documentId}`;
}

export function getQuotePdfHref(quoteId: string) {
  return `/api/quotes/${quoteId}/file`;
}

export function getInvoicePdfHref(invoiceId: string) {
  return `/api/invoices/${invoiceId}/file`;
}

export function getJobDocumentHref(document: Pick<JobDocumentRecord, "id" | "quote_id" | "invoice_id" | "document_type">) {
  if (document.document_type === "quote_pdf" && document.quote_id) {
    return getQuotePdfHref(document.quote_id);
  }

  if (document.document_type === "invoice_pdf" && document.invoice_id) {
    return getInvoicePdfHref(document.invoice_id);
  }

  return getDocumentFileHref(document.id);
}
