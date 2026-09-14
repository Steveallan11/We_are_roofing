import type { JobVariationRecord, QuoteRecord } from "@/lib/types";
import { DEFAULT_QUOTE_EMAIL_MESSAGE } from "@/lib/quotes/email";
import { currency } from "@/lib/utils";
import { EmailShell, EmailIntro, EmailSection, ProjectSummaryCard, Checklist, NumberedSteps, PrimaryCTA, PriceSummary, ContactPanel, DocumentLinks, greeting, type EmailBrand } from "./components";

type Customer = EmailBrand & { customerName: string; customerGreeting?: string | null; messageBody?: string | null; propertyAddress?: string; jobTitle?: string };
type QuoteProps = Customer & { quote: QuoteRecord; quoteUrl: string; revised?: boolean; changes?: string[]; previousValue?: number; revisedValue?: number };
const intro = (p: Customer, fallback: string) => greeting(p.customerName, p.customerGreeting) + EmailIntro(p.messageBody?.trim() || fallback);
const dateLabel = (v?: string | null) => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleDateString("en-GB", {day:"numeric",month:"long",year:"numeric"}) : undefined;
export function quoteSentEmail(p: QuoteProps): string {
  if (p.revised) return revisedQuoteEmail(p);
  const multiple = (p.quote.options?.length ?? 0) > 1;
  const custom = p.messageBody?.trim() && p.messageBody.trim() !== DEFAULT_QUOTE_EMAIL_MESSAGE ? p.messageBody : null;
  return EmailShell("Your roofing proposal","Your quotation is ready",
    greeting(p.customerName,p.customerGreeting) + EmailIntro(custom || `Thank you for the opportunity to provide our proposal${p.propertyAddress ? " for the roofing works at " + p.propertyAddress : ""}.\n\nYour detailed quotation is ready to review, with the proposed works and pricing together in one place.`) +
    ProjectSummaryCard([["Project",p.jobTitle],["Location",p.propertyAddress],["Quote reference",p.quote.quote_ref],["Status","Ready to review"]]) +
    EmailSection("Your proposal includes",Checklist([p.quote.roof_report ? "Detailed roof report" : "",p.quote.scope_of_works ? "Recommended works and full scope" : "",multiple ? "Pricing and available options" : "Project pricing",p.quote.guarantee_text ? "Guarantee and project information" : ""])) +
    PrimaryCTA("VIEW YOUR QUOTATION",p.quoteUrl,multiple ? "Review the full proposal, select your preferred option and accept securely online." : "Review the full quotation and accept securely online.") +
    EmailSection("What happens next?",NumberedSteps(["Review your quotation","Contact us with any questions",...(multiple ? ["Select your preferred option"] : []),"Accept the quotation online","We contact you about programme, access and pre-start arrangements"])) + ContactPanel(p),p);
}
export function revisedQuoteEmail(p: QuoteProps) {
  return EmailShell("Updated quotation","Your revised proposal is ready",intro({...p,messageBody:p.messageBody === DEFAULT_QUOTE_EMAIL_MESSAGE ? null : p.messageBody},`We have updated your quotation${p.propertyAddress ? " for " + p.propertyAddress : ""}. Please review the revised proposal before proceeding.`) +
    ProjectSummaryCard([["Project",p.jobTitle],["Location",p.propertyAddress],["Quote reference",p.quote.quote_ref],["Status","Updated proposal"]]) +
    (p.changes?.length ? EmailSection("What has changed",Checklist(p.changes)) : "") + PriceSummary("Previous quotation",p.previousValue) + PriceSummary("Revised quotation",p.revisedValue) +
    PrimaryCTA("VIEW UPDATED QUOTATION",p.quoteUrl,"Review the updated scope and pricing securely online.") + ContactPanel(p),p);
}
export function surveyConfirmationEmail(p: Customer & {surveyDate:string;surveyTime:string;propertyAddress:string;jobRef:string;surveyorName:string;accessNotes?:string;googleCalLink:string}) {
  return EmailShell("Site visit confirmed","Your roofing assessment is booked",intro(p,`We look forward to visiting${p.propertyAddress ? " " + p.propertyAddress : " your property"} to assess the roofing works.`) +
    ProjectSummaryCard([["Date",p.surveyDate],["Time",p.surveyTime],["Property",p.propertyAddress],["Surveyor",p.surveyorName],["Reference",p.jobRef]],"Appointment details") +
    (p.accessNotes ? EmailSection("Before we arrive",EmailIntro(p.accessNotes)) : "") +
    EmailSection("What we will look at",Checklist(["Condition of roof coverings and detailing","Likely causes of the reported defects","Access requirements and suitable repair or replacement options"])) +
    PrimaryCTA("ADD TO CALENDAR",p.googleCalLink) + ContactPanel(p),p);
}
export function variationSentEmail(p: Customer & {variation:JobVariationRecord;variationUrl:string;propertyAddress:string}) {
  return variationQuoteSentEmail({...p,variations:[p.variation],quoteRef:p.variation.variation_ref});
}
export function variationQuoteSentEmail(p: Customer & {variations:JobVariationRecord[];quoteRef:string;variationUrl:string;propertyAddress:string}) {
  return EmailShell("Project variation","Additional works for approval",intro(p,"Please review the additional works discussed below. These items are presented separately from the original quotation for your approval.") +
    ProjectSummaryCard([["Property",p.propertyAddress],["Reference",p.quoteRef]]) +
    p.variations.map(v=>EmailSection(v.title,EmailIntro(v.description || "") + ProjectSummaryCard([["Net cost",currency(v.subtotal)],["VAT",currency(v.vat_amount)],["Total including VAT",currency(v.total)]],"Cost"))).join("") +
    PrimaryCTA("VIEW ADDITIONAL WORKS",p.variationUrl,"Review the details and confirm which work you would like us to proceed with.") + ContactPanel(p),p);
}
export function invoiceSentEmail(p: Customer & {invoiceRef:string;invoiceUrl:string;jobTitle:string;propertyAddress:string;dueDate:string;total:number;invoiceType?:string|null;isVariation?:boolean;bankName?:string|null;bankSortCode?:string|null;bankAccount?:string|null;bankAccountName?:string|null}) {
  const deposit = p.invoiceType === "deposit";
  const banks: Array<[string,unknown]> = [["Bank",p.bankName],["Sort code",p.bankSortCode],["Account number",p.bankAccount],["Account name",p.bankAccountName]];
  return EmailShell(deposit ? "Booking deposit" : "Payment request",deposit ? "Preparing for your roofing project" : "Your roofing invoice",
    intro(p,deposit ? "Thank you for choosing We Are Roofing UK Ltd. We appreciate your custom and look forward to looking after your project.\n\nYour deposit secures the booking and helps us arrange the materials and pre-start requirements agreed for your project, minimising delays before work begins." : p.isVariation ? "Please find your invoice for the approved additional works." : "Your invoice is ready to review. The payment details are set out below.") +
    ProjectSummaryCard([["Project",p.jobTitle],["Property",p.propertyAddress],["Invoice reference",p.invoiceRef],["Due date",p.dueDate],["Payment stage",deposit ? "Booking deposit" : p.invoiceType]]) +
    PriceSummary("Amount due",p.total) + (banks.some(([,v])=>v) ? ProjectSummaryCard([...banks,["Payment reference",p.invoiceRef]],"Bank details") : "") +
    PrimaryCTA("VIEW INVOICE",p.invoiceUrl,"Open your invoice to view the full document and payment details.") + ContactPanel(p),p);
}
export function nurtureEmail(_day:number,p:Customer & {town?:string|null;quoteUrl:string;quoteRef:string}) {
  return {subject:"Do you have any questions about your quotation?",html:EmailShell("Your roofing proposal","Do you have any questions?",
    intro(p,"We wanted to check that you were able to review your proposal. If you would like us to explain the proposed roofing system, scope, pricing or project process, please reply and we will be happy to help.") +
    ProjectSummaryCard([["Quote reference",p.quoteRef],["Property",p.propertyAddress]]) + PrimaryCTA("REVIEW QUOTATION",p.quoteUrl) +
    EmailIntro("There is no need to accept until you are comfortable with the proposal and understand the recommended works.") + ContactPanel(p),p)};
}
export function quoteAcceptedEmail(p:Customer & {quoteRef?:string;selectedOption?:string;total?:number;acceptedAt?:string}) {
  return EmailShell("Quotation accepted","Thank you for choosing us",intro(p,"Thank you for accepting our quotation. We have recorded your acceptance and will now begin the pre-start process.") +
    ProjectSummaryCard([["Project",p.jobTitle],["Property",p.propertyAddress],["Quote reference",p.quoteRef],["Selected option",p.selectedOption],["Date accepted",dateLabel(p.acceptedAt)]],"Accepted proposal") + PriceSummary("Accepted contract value",p.total) +
    EmailSection("What happens next?",NumberedSteps(["We review the accepted project internally","Final specification requirements are confirmed","Access arrangements are reviewed where applicable","We discuss the programme and proposed start date","We issue the pre-start information"])) + ContactPanel(p),p);
}
export function paymentReceivedEmail(p:Customer & {invoiceRef?:string;amount?:number;receivedAt?:string}) {
  return EmailShell("Payment received","Thank you for your payment",intro(p,"We have recorded your payment. Thank you.") + ProjectSummaryCard([["Project",p.jobTitle],["Invoice reference",p.invoiceRef],["Payment date",dateLabel(p.receivedAt)]]) + PriceSummary("Payment received",p.amount) + ContactPanel(p),p);
}
export function projectCompletionEmail(p:Customer & {completedWorks?:string;documents?:Array<{label:string;url:string}>}) {
  return EmailShell("Project completion","Your roofing works are complete",intro(p,`We are pleased to confirm that the roofing works${p.propertyAddress ? " at " + p.propertyAddress : ""} have been completed.`) + (p.completedWorks ? EmailSection("Completed works",EmailIntro(p.completedWorks)) : "") + EmailSection("Handover documents",DocumentLinks(p.documents || [])) + ContactPanel(p),p);
}
