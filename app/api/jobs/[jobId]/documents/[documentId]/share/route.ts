import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";
import { generateSecureToken } from "@/lib/utils";

type Props = {
  params: Promise<{ jobId: string; documentId: string }>;
};

type RequestBody = {
  expires_days?: number;
  action?: "create" | "revoke" | "list";
};

export async function POST(request: Request, { params }: Props) {
  const { jobId, documentId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Share token creation preview completed." });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as RequestBody;

  try {
    const supabase = createSupabaseAdminClient();

    if (body.action === "list") {
      // List existing shares for this document
      const { data: shares, error } = await supabase
        .from("job_document_shares")
        .select("*")
        .eq("document_id", documentId)
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        data: shares
      });
    }

    if (body.action === "revoke") {
      // Revoke all shares for this document
      const { error } = await supabase
        .from("job_document_shares")
        .update({ is_active: false })
        .eq("document_id", documentId)
        .eq("job_id", jobId);

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        message: "All share links revoked"
      });
    }

    // Default: Create new share token
    // Verify document exists and belongs to job
    const { data: document, error: docError } = await supabase
      .from("job_documents")
      .select("*")
      .eq("id", documentId)
      .eq("job_id", jobId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // Generate unique share token
    const shareToken = generateSecureToken(32);
    const expiresAt = body.expires_days
      ? new Date(Date.now() + body.expires_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Create share record
    const { data: share, error: shareError } = await supabase
      .from("job_document_shares")
      .insert({
        job_id: jobId,
        document_id: documentId,
        share_token: shareToken,
        created_by: auth.session?.user?.id || "anonymous",
        expires_at: expiresAt,
        is_active: true
      })
      .select("*")
      .single();

    if (shareError || !share) {
      return NextResponse.json({ ok: false, error: "Failed to create share link" }, { status: 500 });
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/${shareToken}`;

    return NextResponse.json({
      ok: true,
      data: {
        ...share,
        share_url: shareUrl
      }
    });
  } catch (error) {
    console.error("Share creation error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create share link" },
      { status: 500 }
    );
  }
}
