import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { quote_id?: string; to_email?: string; subject?: string; body?: string };
  if (!body.quote_id) return NextResponse.json({ ok: false, error: "quote_id is required." }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const cookie = request.headers.get("cookie");
  const response = await fetch(`${appUrl}/api/quotes/${body.quote_id}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify({
      to_email: body.to_email,
      subject: body.subject || "Your We Are Roofing quotation",
      body: body.body || "Your roofing quote is ready to view."
    })
  });
  const result = await response.json().catch(() => null);
  return NextResponse.json(result ?? { ok: response.ok }, { status: response.status });
}
