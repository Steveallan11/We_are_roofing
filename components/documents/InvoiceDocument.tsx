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
  const isDeposit = invoice.invoice_type === "deposit";
  const isReverseCharge = invoice.vat_treatment === "domestic_reverse_charge";
  const cisDeduction = Number(invoice.cis_deduction_amount ?? 0);
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
        {isReverseCharge || cisDeduction > 0 ? (
          <div style={{ background: DOC.dark, borderLeft: `6px solid ${DOC.gold}`, color: DOC.white, margin: "18px 0", padding: "16px 18px" }}>
            <p style={{ color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", margin: "0 0 8px", textTransform: "uppercase" }}>Invoice tax treatment</p>
            {isReverseCharge ? <p style={{ fontFamily: DOC.fontSans, fontSize: 14, fontWeight: 800, margin: "0 0 5px" }}>DOMESTIC REVERSE CHARGE — CUSTOMER ACCOUNTS FOR VAT</p> : null}
            {cisDeduction > 0 ? <p style={{ fontFamily: DOC.fontSans, fontSize: 14, fontWeight: 800, margin: 0 }}>CIS: CUSTOMER DEDUCTS {currency(cisDeduction)} FROM OUR LABOUR</p> : null}
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <AddressBlock label="Customer" lines={[bundle.customer.full_name, bundle.job.property_address, bundle.job.postcode]} />
          <AddressBlock label="Bank Details" lines={[bundle.business.bank_account_name, bundle.business.bank_name, bundle.business.bank_sort_code ? `Sort Code: ${bundle.business.bank_sort_code}` : null, bundle.business.bank_account ? `Account: ${bundle.business.bank_account}` : null]} />
        </div>
        <SectionHead>{isDeposit ? "Booking Deposit" : "Works Completed"}</SectionHead>
        {isDeposit ? (
          <>
            <p style={paragraphStyle}>
              Thank you for choosing We Are Roofing. This deposit secures your booking in our schedule for {bundle.job.job_title} at{" "}
              {bundle.job.property_address}.
            </p>
            <p style={paragraphStyle}>
              It allows us to begin arranging the items needed before work commences, including materials, scaffold/access, skips, welfare
              facilities, and other job preparation where required. Getting these in place early helps minimise delays once the works start.
            </p>
          </>
        ) : (
          <p style={paragraphStyle}>Works completed at {bundle.job.property_address} as agreed for {bundle.job.job_title}.</p>
        )}
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
            { label: isReverseCharge ? "VAT payable to us" : "VAT", value: currency(invoice.vat_amount) },
            ...(isReverseCharge
              ? [{ label: "Reverse charge VAT — customer accounts to HMRC", value: currency(Number(invoice.reverse_charge_vat_amount ?? 0)) }]
              : []),
            { label: "Invoice Total", value: currency(invoice.total), strong: true },
            ...(Number(invoice.cis_deduction_amount ?? 0) > 0
              ? [
                  { label: `CIS Deduction (${Number(invoice.cis_deduction_rate ?? 0)}%)`, value: `-${currency(Number(invoice.cis_deduction_amount ?? 0))}` },
                  { label: "Amount Payable", value: currency(Math.max(0, invoice.total - Number(invoice.cis_deduction_amount ?? 0))), strong: true }
                ]
              : []),
            { label: "Paid", value: currency(invoice.amount_paid) },
            { label: "Balance Due", value: currency(invoice.balance_due), strong: invoice.balance_due > 0 }
          ]}
        />
        {Number(invoice.cis_deduction_amount ?? 0) > 0 ? (
          <div style={{ marginTop: 22, borderLeft: `4px solid ${DOC.gold}`, background: "#f2eddf", borderRadius: 12, padding: 16 }}>
            <p style={{ ...paragraphStyle, fontWeight: 700 }}>Construction Industry Scheme (CIS)</p>
            <p style={{ ...paragraphStyle, marginTop: 6 }}>
              CIS is calculated at {Number(invoice.cis_deduction_rate ?? 0)}% on the VAT-exclusive labour amount of {currency(Number(invoice.cis_labour_amount ?? 0))}. Materials and VAT are excluded. CIS withheld: {currency(Number(invoice.cis_deduction_amount ?? 0))}.
            </p>
          </div>
        ) : null}
        {isReverseCharge ? (
          <div style={{ marginTop: 22, borderLeft: `4px solid ${DOC.gold}`, background: "#f2eddf", borderRadius: 12, padding: 16 }}>
            <p style={{ ...paragraphStyle, fontWeight: 700 }}>Domestic Reverse Charge</p>
            <p style={{ ...paragraphStyle, marginTop: 6 }}>
              Reverse charge: VAT Act 1994 Section 55A applies. The customer must account to HMRC for VAT of {currency(Number(invoice.reverse_charge_vat_amount ?? 0))}; this VAT is not payable to us. Customer VAT number: {invoice.customer_vat_number || "Not supplied"}.
            </p>
          </div>
        ) : null}
        <div style={{ marginTop: 24, borderLeft: `4px solid ${invoice.balance_due > 0 ? "#f59e0b" : "#10b981"}`, background: "#f2eddf", borderRadius: 12, padding: 16 }}>
          <p style={paragraphStyle}>{invoice.payment_terms || bundle.business.payment_terms || "Payment due on receipt."}</p>
        </div>
      </DocumentBody>
      <DocFooter business={bundle.business} />
    </DocumentFrame>
  );
}
