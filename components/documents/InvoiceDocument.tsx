import { AddressBlock } from "@/components/documents/shared/AddressBlock";
import { DocFooter } from "@/components/documents/shared/DocFooter";
import { DocHeader } from "@/components/documents/shared/DocHeader";
import { DocumentBody, DocumentFrame, paragraphStyle } from "@/components/documents/shared/DocumentFrame";
import { LineItemTable } from "@/components/documents/shared/LineItemTable";
import { MetaStrip } from "@/components/documents/shared/MetaStrip";
import { SectionHead } from "@/components/documents/shared/SectionHead";
import { DOC } from "@/lib/theme/documentTheme";
import { currency, formatDate } from "@/lib/utils";
import type { InvoiceRecord, JobBundle } from "@/lib/types";

export function InvoiceDocument({ bundle, invoice }: { bundle: JobBundle; invoice: InvoiceRecord }) {
  return (
    <DocumentFrame>
      <DocHeader title="Invoice" reference={invoice.invoice_ref} subtitle={bundle.business.trading_address} meta={`Due ${formatDate(invoice.due_date)}`} />
      <DocumentBody>
        <MetaStrip
          items={[
            { label: "Job Ref", value: bundle.job.job_ref },
            { label: "Quote Ref", value: bundle.quote?.quote_ref },
            { label: "Payment Due", value: formatDate(invoice.due_date) },
            { label: "Status", value: invoice.status }
          ]}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <AddressBlock label="Customer" lines={[bundle.customer.full_name, bundle.job.property_address, bundle.job.postcode]} />
          <AddressBlock label="Bank Details" lines={[bundle.business.bank_account_name, bundle.business.bank_name, bundle.business.bank_sort_code ? `Sort Code: ${bundle.business.bank_sort_code}` : null, bundle.business.bank_account ? `Account: ${bundle.business.bank_account}` : null]} />
        </div>
        <SectionHead>Works Completed</SectionHead>
        <p style={paragraphStyle}>Works completed at {bundle.job.property_address} as agreed for {bundle.job.job_title}.</p>
        <SectionHead>Invoice Items</SectionHead>
        <LineItemTable
          rows={invoice.line_items.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            amount: currency(line.total)
          }))}
          totals={[
            { label: "Subtotal", value: currency(invoice.subtotal) },
            { label: "VAT", value: currency(invoice.vat_amount) },
            { label: "Total", value: currency(invoice.total), strong: true },
            { label: "Paid", value: currency(invoice.amount_paid) },
            { label: "Balance Due", value: currency(invoice.balance_due), strong: invoice.balance_due > 0 }
          ]}
        />
        <div style={{ marginTop: 24, borderLeft: `4px solid ${invoice.balance_due > 0 ? "#f59e0b" : "#10b981"}`, background: "#f2eddf", borderRadius: 12, padding: 16 }}>
          <p style={paragraphStyle}>{invoice.payment_terms || bundle.business.payment_terms || "Payment due on receipt."}</p>
        </div>
      </DocumentBody>
      <DocFooter business={bundle.business} />
    </DocumentFrame>
  );
}
