import { NextResponse } from "next/server";
import { Resend } from "resend";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { quoteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    to_email?: string;
    subject?: string;
    body?: string;
  };

  if (!body.to_email || !body.subject || !body.body) {
    return NextResponse.json({ ok: false, error: "to_email, subject and body are required" }, { status: 400 });
  }

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [body.to_email],
      subject: body.subject,
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${body.body}</div>`
    });

    return NextResponse.json({
      ok: true,
      quoteId,
      provider_message_id: result.data?.id ?? null,
      message: "Quote email sent through Resend.",
      next_job_status: "Quote Sent",
      next_quote_status: "Sent"
    });
  }

  return NextResponse.json({
    ok: true,
    quoteId,
    message: "Send quote endpoint scaffolded. RESEND_API_KEY not configured, so no email was sent.",
    next_job_status: "Quote Sent",
    next_quote_status: "Sent"
  });
}
