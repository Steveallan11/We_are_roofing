import { NextResponse } from "next/server";
import { surveySchema } from "@/lib/validators";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId } = await params;
  const body = await request.json();
  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    jobId,
    message: "Survey payload accepted.",
    next_status: parsed.data.no_photo_confirmation ? "Ready For AI Quote" : "Survey Complete",
    received: parsed.data
  });
}
