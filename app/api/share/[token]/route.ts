import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, { params }: Props) {
  const { token } = await params;

  try {
    const supabase = createSupabaseAdminClient();

    // Get share record
    const { data: share, error: shareError } = await supabase
      .from("job_document_shares")
      .select("*")
      .eq("share_token", token)
      .eq("is_active", true)
      .single();

    if (shareError || !share) {
      return NextResponse.json({ ok: false, error: "Share link not found or expired" }, { status: 404 });
    }

    // Check if expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "Share link has expired" }, { status: 410 });
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from("job_documents")
      .select("*")
      .eq("id", share.document_id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // Get job for context
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", share.job_id)
      .single();

    // Update access tracking
    await supabase
      .from("job_document_shares")
      .update({
        access_count: (share.access_count || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq("id", share.id);

    // Return share details
    return NextResponse.json({
      ok: true,
      data: {
        document: {
          id: document.id,
          display_name: document.display_name,
          mime_type: document.mime_type,
          file_size: document.file_size,
          created_at: document.created_at
        },
        job: job
          ? {
              id: job.id,
              job_ref: job.job_ref,
              job_title: job.job_title,
              property_address: job.property_address
            }
          : null,
        share: {
          expires_at: share.expires_at,
          created_at: share.created_at
        }
      }
    });
  } catch (error) {
    console.error("Share access error:", error);
    return NextResponse.json({ ok: false, error: "Failed to access shared document" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Props) {
  const { token } = await params;

  try {
    const supabase = createSupabaseAdminClient();

    // Get share record
    const { data: share, error: shareError } = await supabase
      .from("job_document_shares")
      .select("*")
      .eq("share_token", token)
      .eq("is_active", true)
      .single();

    if (shareError || !share) {
      return NextResponse.json({ ok: false, error: "Share link not found" }, { status: 404 });
    }

    // Check if expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "Share link has expired" }, { status: 410 });
    }

    // Get document
    const { data: document, error: docError } = await supabase
      .from("job_documents")
      .select("*")
      .eq("id", share.document_id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(document.storage_bucket!)
      .download(document.storage_path!);

    if (downloadError || !fileData) {
      return NextResponse.json({ ok: false, error: "Failed to download document" }, { status: 500 });
    }

    // Update access count
    await supabase
      .from("job_document_shares")
      .update({
        access_count: (share.access_count || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq("id", share.id);

    // Return file
    return new NextResponse(fileData, {
      headers: {
        "Content-Type": document.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${document.display_name}"`
      }
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ ok: false, error: "Failed to download document" }, { status: 500 });
  }
}
