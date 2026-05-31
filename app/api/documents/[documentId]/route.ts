import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = {
  params: Promise<{ documentId: string }>;
};

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function GET(_request: Request, { params }: Props) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { documentId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: document, error } = await supabase.from("job_documents").select("*").eq("id", documentId).single();

  if (error || !document) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Document not found." }, { status: 404 });
  }

  if (document.mime_type?.includes("text/html") && document.content_html) {
    return new Response(document.content_html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store"
      }
    });
  }

  if (document.storage_bucket && document.storage_path) {
    const signed = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, DEFAULT_SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ ok: false, error: signed.error?.message ?? "Could not open this document." }, { status: 500 });
    }

    return NextResponse.redirect(signed.data.signedUrl);
  }

  if (document.public_url) {
    return NextResponse.redirect(document.public_url);
  }

  return NextResponse.json({ ok: false, error: "This document does not have a stored file." }, { status: 404 });
}
