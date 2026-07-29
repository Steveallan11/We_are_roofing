import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { markOverdueInvoices } from "@/lib/invoices/markOverdue";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  return runOverdueCheck(request);
}

export async function POST(request: Request) {
  return runOverdueCheck(request);
}

async function runOverdueCheck(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const cronAuthorized =
    Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (!cronAuthorized) {
    const auth = await requireAdminApi();
    if (!auth.ok) return auth.response;
  }

  try {
    const result = await markOverdueInvoices(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Invoice overdue check failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to update overdue invoices." },
      { status: 500 }
    );
  }
}
