import type { QuoteOption, QuoteRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

const shell = (title: string, body: string) => `
  <div style="background:#f8f7f4;padding:40px 20px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:580px;margin:0 auto">
      <div style="background:#0a0a0a;padding:28px 32px;border-radius:8px 8px 0 0">
        <div style="color:#D4AF37;font-size:22px;font-weight:700;font-family:Georgia,serif">We Are Roofing UK Ltd</div>
        <div style="color:#777;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">${title}</div>
      </div>
      <div style="background:#fff;border:1px solid #e8e4da;border-top:0;padding:32px;color:#1a1a1a">${body}</div>
      <div style="background:#0a0a0a;padding:16px 32px;border-radius:0 0 8px 8px;text-align:center;color:#666;font-size:11px">
        We Are Roofing UK Ltd · Yateley, Hampshire · 01252 000000
      </div>
    </div>
  </div>
`;

export function surveyConfirmationEmail(props: {
  customerName: string;
  surveyDate: string;
  surveyTime: string;
  propertyAddress: string;
  jobRef: string;
  surveyorName: string;
  accessNotes?: string;
  googleCalLink: string;
}) {
  const firstName = props.customerName.split(" ")[0] || props.customerName;
  return shell(
    "Survey Confirmed",
    `
      <p style="font-size:16px;margin-top:0">Hi ${firstName},</p>
      <p style="font-size:14px;line-height:1.6;color:#555">Your roof survey has been confirmed. Here are the details:</p>
      <div style="background:#faf9f6;border:1px solid #e8e4da;border-left:3px solid #D4AF37;border-radius:6px;padding:16px 20px;margin:20px 0">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:700">Survey details</div>
        <p style="font-size:16px;font-weight:700;margin:8px 0 4px">Date: ${props.surveyDate} at ${props.surveyTime}</p>
        <p style="font-size:13px;color:#555;margin:4px 0">Address: ${props.propertyAddress}</p>
        <p style="font-size:13px;color:#555;margin:4px 0">Surveyor: ${props.surveyorName}</p>
        <p style="font-size:11px;color:#888;margin:4px 0">Reference: ${props.jobRef}</p>
        ${props.accessNotes ? `<p style="font-size:12px;color:#777;margin-top:8px"><em>Access notes: ${props.accessNotes}</em></p>` : ""}
      </div>
      <p style="font-size:13px;font-weight:700">What to expect:</p>
      <p style="font-size:13px;color:#555;line-height:1.7">
        We will inspect the roof, photograph any areas of concern, take the measurements needed, and follow up with a clear report and quote.
      </p>
      <p style="text-align:center;margin:26px 0 4px">
        <a href="${props.googleCalLink}" style="background:#D4AF37;color:#000;padding:10px 20px;border-radius:6px;font-size:12px;font-weight:700;text-decoration:none">Add to Google Calendar</a>
      </p>
    `
  );
}

export function quoteSentEmail(props: { customerName: string; quote: QuoteRecord; quoteUrl: string }) {
  const options = (props.quote.options ?? []) as QuoteOption[];
  const totals = options.length
    ? options
        .map(
          (option) => `
            <div style="display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid #eee3bd;padding:10px 0">
              <span style="font-size:14px;color:#555">${option.label}${option.recommended ? " (recommended)" : ""}</span>
              <strong style="font-size:16px;color:#1a1a1a">${currency(option.total)}</strong>
            </div>`
        )
        .join("")
    : `
      <div style="display:flex;justify-content:space-between;gap:14px">
        <span style="font-size:14px;color:#555">Total</span>
        <strong style="font-size:22px;color:#1a1a1a">${currency(props.quote.total)}</strong>
      </div>`;

  return shell(
    "Your Roofing Quote Is Ready",
    `
      <p style="font-size:18px;line-height:1.5;margin-top:0;color:#1a1a1a">Hi ${props.customerName.split(" ")[0] || props.customerName},</p>
      <p style="font-size:16px;line-height:1.75;color:#555;margin:0 0 18px">
        Your roofing quotation is ready to review. The quote page is laid out in clear sections so you can see the roof report, the proposed works, and the price breakdown without having to dig through small print.
      </p>
      <div style="background:#faf6e8;border:1px solid #e8d7a1;border-left:4px solid #D4AF37;border-radius:8px;padding:18px 20px;margin:22px 0">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8d6a00;margin-bottom:8px">Quote Summary</div>
        ${totals}
      </div>
      <div style="background:#faf9f6;border:1px solid #e8e4da;border-radius:8px;padding:18px 20px;margin:22px 0">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8d6a00;margin-bottom:10px">What is inside</div>
        <p style="font-size:15px;line-height:1.75;color:#555;margin:0 0 8px">1. Roof report - what we found and what it means.</p>
        <p style="font-size:15px;line-height:1.75;color:#555;margin:0 0 8px">2. Scope of works - what is included in the job.</p>
        <p style="font-size:15px;line-height:1.75;color:#555;margin:0">3. Price breakdown - options, measurements, totals, and the next step.</p>
      </div>
      <p style="text-align:center;margin:30px 0">
        <a href="${props.quoteUrl}" style="background:#D4AF37;color:#000;padding:15px 28px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;display:inline-block">View and Accept Quote</a>
      </p>
      <p style="font-size:15px;color:#555;line-height:1.75;margin-bottom:0">If anything is unclear, just reply to this email or use the question box on the quote page and Andy will talk you through it.</p>
    `
  );
}

export function invoiceSentEmail(props: {
  customerName: string;
  invoiceRef: string;
  invoiceUrl: string;
  jobTitle: string;
  propertyAddress: string;
  dueDate: string;
  total: number;
  bankName?: string | null;
  bankSortCode?: string | null;
  bankAccount?: string | null;
  bankAccountName?: string | null;
}) {
  const firstName = props.customerName.split(" ")[0] || props.customerName;
  return shell(
    "Your Roofing Invoice",
    `
      <div style="background:#faf6e8;border:1px solid #e8d7a1;border-left:4px solid #D4AF37;border-radius:6px;padding:14px 18px;margin-bottom:22px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8d6a00">Payment Due</div>
        <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-top:6px">Please pay by ${props.dueDate}</div>
      </div>
      <p style="font-size:16px;margin-top:0">Hi ${firstName},</p>
      <p style="font-size:14px;line-height:1.6;color:#555">
        Please find your invoice for ${props.jobTitle} at ${props.propertyAddress}.
      </p>
      <div style="background:#faf9f6;border:1px solid #e8e4da;border-radius:8px;padding:16px 18px;margin:20px 0">
        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#555">
          <span>Invoice reference</span>
          <strong style="color:#1a1a1a">${props.invoiceRef}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#555;margin-top:8px">
          <span>Total due</span>
          <strong style="color:#1a1a1a">${currency(props.total)}</strong>
        </div>
      </div>
      <div style="background:#faf9f6;border:1px solid #e8e4da;border-left:4px solid #D4AF37;border-radius:6px;padding:16px 18px;margin:22px 0">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8d6a00;margin-bottom:8px">Bank Details</div>
        <div style="font-size:13px;color:#555;line-height:1.8">
          <div>Bank: ${props.bankName || "Please contact Andy for bank details"}</div>
          <div>Sort code: ${props.bankSortCode || "Available on request"}</div>
          <div>Account number: ${props.bankAccount || "Available on request"}</div>
          <div>Account name: ${props.bankAccountName || "We Are Roofing UK Ltd"}</div>
          <div>Payment reference: ${props.invoiceRef}</div>
        </div>
      </div>
      <p style="text-align:center;margin:26px 0">
        <a href="${props.invoiceUrl}" style="background:#D4AF37;color:#000;padding:12px 22px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none">View invoice</a>
      </p>
      <p style="font-size:13px;color:#555;line-height:1.6">If you have any questions about this invoice, just reply to this email and we will help.</p>
    `
  );
}

export function nurtureEmail(day: number, props: { customerName: string; town?: string | null; quoteUrl: string; quoteRef: string }) {
  const firstName = props.customerName.split(" ")[0] || props.customerName;
  const copy: Record<number, { title: string; body: string }> = {
    2: { title: `Any questions about your quote, ${firstName}?`, body: `Just checking in to see if you had any questions about quote ${props.quoteRef}. Happy to talk through any aspect of it on the phone.` },
    5: { title: `A similar job near ${props.town || "you"}`, body: "We recently helped a homeowner with a similar roofing issue. The main thing is making sure the scope is clear, safe, and properly guaranteed before any work starts." },
    10: { title: "What to look for when choosing a roofer", body: "A good quote should clearly explain access, scaffold, materials, waste, guarantees, and exactly what is excluded. If anything is vague, ask before you commit." },
    14: { title: "Your quote is still valid", body: "Just a reminder that material and scaffold pricing can move, but your quote is still here for review if you would like to proceed." },
    21: { title: `Still here if you need us, ${firstName}`, body: "If now is not the right time, no problem at all. When you are ready, we are still here to help." }
  };
  const item = copy[day] ?? copy[2];
  return {
    subject: item.title,
    html: shell(
      `Quote Follow-up Day ${day}`,
      `<p style="font-size:16px;margin-top:0">Hi ${firstName},</p><p style="font-size:14px;line-height:1.7;color:#555">${item.body}</p><p style="text-align:center;margin:24px 0"><a href="${props.quoteUrl}" style="background:#D4AF37;color:#000;padding:10px 20px;border-radius:6px;font-size:12px;font-weight:700;text-decoration:none">View quote</a></p>`
    )
  };
}
