import { NextResponse } from "next/server";
import { photoMetadataSchema } from "@/lib/validators";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = await request.json();
  const parsed = photoMetadataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    jobId,
    message: "Photo metadata accepted.",
    next_status: "Ready For AI Quote",
    storage_path: `${jobId}/${Date.now()}-${parsed.data.file_name}`,
    received: parsed.data
  });
}
