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
    ? options.map((option) => `<li>${option.label}: <strong>${currency(option.total)}</strong>${option.recommended ? " (recommended)" : ""}</li>`).join("")
    : `<li>Total: <strong>${currency(props.quote.total)}</strong></li>`;

  return shell(
    "Your Roofing Quote Is Ready",
    `
      <p style="font-size:16px;margin-top:0">Hi ${props.customerName.split(" ")[0] || props.customerName},</p>
      <p style="font-size:14px;line-height:1.6;color:#555">Your roofing quotation is ready to review. We have kept the wording clear so you can see exactly what is included.</p>
      <ul style="font-size:14px;color:#333;line-height:1.7">${totals}</ul>
      <p style="text-align:center;margin:26px 0">
        <a href="${props.quoteUrl}" style="background:#D4AF37;color:#000;padding:12px 22px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none">View and Accept Quote</a>
      </p>
      <p style="font-size:13px;color:#555;line-height:1.6">If you have any questions, just reply to this email and Andy will talk you through it.</p>
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
