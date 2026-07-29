import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = {
  params: Promise<{ receiptId: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { receiptId } = await params;
  const supabase = createSupabaseAdminClient();
  const lookup = await supabase
    .from("receipt_inbox")
    .select("storage_bucket, storage_path")
    .eq("id", receiptId)
    .maybeSingle();

  if (lookup.error || !lookup.data) {
    return NextResponse.json({ ok: false, error: lookup.error?.message ?? "Receipt not found." }, { status: 404 });
  }

  const signed = await supabase.storage
    .from(lookup.data.storage_bucket)
    .createSignedUrl(lookup.data.storage_path, 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ ok: false, error: signed.error?.message ?? "Could not open receipt." }, { status: 500 });
  }

  return NextResponse.redirect(signed.data.signedUrl);
}
