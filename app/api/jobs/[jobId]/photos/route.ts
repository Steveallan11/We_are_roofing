import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const photoType = (formData.get("photo_type") as string) || "General";
    const caption = (formData.get("caption") as string) || null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `jobs/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("job-photos").getPublicUrl(path);

    const { data: photo, error: dbError } = await supabase
      .from("job_photos")
      .insert({
        job_id: jobId,
        storage_path: path,
        public_url: urlData.publicUrl,
        photo_type: photoType,
        caption,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, photo }, { status: 201 });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("job_photos")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
