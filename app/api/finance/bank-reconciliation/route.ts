import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getBusiness } from "@/lib/data";
import { executeFinanceTool } from "@/lib/finance/service";

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const business = await getBusiness();
    const result = await executeFinanceTool("categorise_bank_transaction", { ...body, confirmed: true }, { pathname: "/api/finance/bank-reconciliation", businessId: business.id, actorId: auth.session.user.id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Transaction could not be reviewed." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const business = await getBusiness();
    const result = await executeFinanceTool("commit_bank_statement_import", { import_ref: body.import_ref, confirmed: true }, { pathname: "/api/finance/bank-reconciliation", businessId: business.id, actorId: auth.session.user.id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Statement could not be committed." }, { status: 400 });
  }
}
