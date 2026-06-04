import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ ok: false, error: "No file in form data" }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    const dataUrl = await file.arrayBuffer().then((buf) => {
      const base64 = Buffer.from(buf).toString("base64");
      const mimeType = file.type || "application/octet-stream";
      return `data:${mimeType};base64,${base64}`;
    });
    return NextResponse.json({
      ok: true,
      url: dataUrl,
      name: file.name,
      size: file.size,
      type: file.type
    });
  }

  const supabase = createSupabaseAdminClient();
  const fileExtension = file.name.split(".").pop() || "bin";
  const fileName = `diary/${Date.now()}-${randomUUID()}.${fileExtension}`;

  const buffer = await file.arrayBuffer();
  const { data, error } = await supabase.storage.from("diagrams").upload(fileName, buffer, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from("diagrams").getPublicUrl(fileName);
  return NextResponse.json({
    ok: true,
    url: publicUrl.publicUrl,
    name: file.name,
    size: file.size,
    type: file.type
  });
}
