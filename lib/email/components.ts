export type EmailBrand = { businessPhone?: string | null; businessEmail?: string | null; logoUrl?: string | null };
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const visible = (value: unknown) => value != null && String(value).trim() !== "" && !["undefined", "null", "N/A"].includes(String(value));
export function safeEmailUrl(value: string) {
  try { const url = new URL(value); return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? escapeHtml(value) : ""; } catch { return ""; }
}
export function EmailIntro(text: string) {
  return text.replace(/\r\n/g, "\n").split(/\n{2,}/).filter(p => p.trim()).map(p => `<p style="margin:0 0 18px;color:#4a4a4a;font-size:16px;line-height:1.65;overflow-wrap:anywhere">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
}
export function greeting(name?: string | null, override?: string | null) {
  const clean = (override || name || "").replace(/\s+/g, " ").trim();
  const preserve = override || /&|\band\b|^(mr|mrs|ms|miss|dr)\b|\b(ltd|limited|maintenance|management|properties|services)\b/i.test(clean) || /^[a-z]\.?(\s|$)/i.test(clean);
  return EmailIntro(clean ? `Hi ${preserve ? clean : clean.split(" ")[0]},` : "Hello,");
}
export const EmailSection = (title: string, body: string) => body ? `<section style="margin:28px 0"><h2 style="font-size:20px;line-height:1.35;color:#202020;margin:0 0 14px;font-weight:700">${escapeHtml(title)}</h2>${body}</section>` : "";
export function InfoGrid(items: Array<[string, unknown]>) {
  return items.filter(([,v]) => visible(v)).map(([label,value]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e4e3df"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#666;margin-bottom:4px">${escapeHtml(label)}</div><div style="font-size:16px;line-height:1.5;color:#202020;overflow-wrap:anywhere">${escapeHtml(value)}</div></td></tr>`).join("");
}
export const ProjectSummaryCard = (items: Array<[string, unknown]>, title = "Project details") => items.some(([,v]) => visible(v)) ? EmailSection(title, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f3;border-radius:8px"><tr><td style="padding:8px 20px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${InfoGrid(items)}</table></td></tr></table>`) : "";
export const Checklist = (items: string[]) => `<ul style="padding-left:22px;margin:0;color:#4a4a4a;font-size:16px;line-height:1.65">${items.filter(Boolean).map(item => `<li style="padding-bottom:8px">${escapeHtml(item)}</li>`).join("")}</ul>`;
export const NumberedSteps = (items: string[]) => Checklist(items).replace("<ul ", "<ol ").replace("</ul>", "</ol>");
export function PrimaryCTA(label: string, url: string, helper?: string) {
  const href = safeEmailUrl(url);
  return href ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 14px"><tr><td align="center" bgcolor="#d4af37" style="background:#d4af37;border-radius:6px;mso-padding-alt:18px 24px"><a href="${href}" style="display:block;padding:18px 24px;color:#161616;font-size:16px;line-height:1.4;font-weight:700;text-decoration:none;text-align:center">${escapeHtml(label)}</a></td></tr></table>${helper ? EmailIntro(helper) : ""}` : "";
}
export function PriceSummary(label: string, amount?: number | null) {
  return amount != null && Number.isFinite(amount) && amount > 0 ? `<div style="background:#faf6e8;border-left:3px solid #a17d14;padding:20px;margin:24px 0"><div style="color:#655011;font-size:13px;letter-spacing:1px;text-transform:uppercase">${escapeHtml(label)}</div><div style="font-size:30px;line-height:1.4;font-weight:700;color:#202020;margin-top:6px">${escapeHtml(new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(amount))}</div></div>` : "";
}
export function DocumentLinks(items: Array<{label: string; url: string}>) {
  return items.filter(item => safeEmailUrl(item.url)).map(item => `<p style="margin:0 0 14px"><a href="${safeEmailUrl(item.url)}" style="color:#755b0d;font-size:16px;line-height:1.5;text-decoration:underline">${escapeHtml(item.label)}</a></p>`).join("");
}
export function ContactPanel(brand: EmailBrand = {}) {
  const phone = "0800 955 8202";
  return EmailSection("Need to speak to us?", EmailIntro("Simply reply to this email or call us.") + `<a href="tel:${escapeHtml(phone.replace(/[^+\d]/g,""))}" style="color:#202020;font-weight:700;font-size:18px">${escapeHtml(phone)}</a>`);
}
export function EmailShell(category: string, heading: string, body: string, brand: EmailBrand = {}) {
  const phone = "0800 955 8202";
  const email = "werroofinguk@gmail.com";
  const logoUrl = brand.logoUrl || "https://we-are-roofing-one.vercel.app/we-are-roofing-logo.png";
  const logo = safeEmailUrl(logoUrl) ? `<img src="${safeEmailUrl(logoUrl)}" alt="We Are Roofing UK" width="130" style="display:block;width:130px;max-width:100%;height:auto;margin-bottom:12px">` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(heading)}</title><style>@media only screen and (max-width:600px){.email-pad{padding:24px 20px!important}.email-title{font-size:26px!important}.email-outer{padding:12px 0!important}}</style></head><body style="margin:0;padding:0;background:#f2f2ef;font-family:Arial,Helvetica,sans-serif;color:#202020"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(heading)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f2f2ef"><tr><td class="email-outer" align="center" style="padding:32px 12px"><!--[if mso]><table role="presentation" width="640"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:640px;background:#fff"><tr><td class="email-pad" style="padding:28px 36px;border-top:4px solid #d4af37;border-bottom:1px solid #e4e3df">${logo}<div style="font-size:21px;letter-spacing:1px;font-weight:700;color:#202020">WE ARE ROOFING UK</div></td></tr><tr><td class="email-pad" style="padding:34px 36px"><div style="font-size:12px;line-height:1.5;font-weight:700;letter-spacing:1.8px;color:#806315;text-transform:uppercase;margin-bottom:12px">${escapeHtml(category)}</div><h1 class="email-title" style="font-size:30px;line-height:1.2;color:#202020;margin:0 0 26px;font-weight:700">${escapeHtml(heading)}</h1>${body}</td></tr><tr><td class="email-pad" style="padding:24px 36px;border-top:1px solid #e4e3df;background:#f7f7f4;font-size:14px;line-height:1.7;color:#555"><strong style="color:#202020">We Are Roofing UK Ltd</strong><br><a style="color:#555" href="tel:${escapeHtml(phone.replace(/[^+\d]/g,""))}">${escapeHtml(phone)}</a><br><a style="color:#555" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><p style="margin:12px 0 0;font-size:13px">Please reply directly to this email if you have any questions.</p></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
