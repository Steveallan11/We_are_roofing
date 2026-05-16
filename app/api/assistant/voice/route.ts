import { NextResponse } from "next/server";
import { requireServerEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const env = requireServerEnv();
  if (!env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY is not configured for server-side transcription." }, { status: 501 });
  }

  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ ok: false, error: "Audio file is required." }, { status: 400 });
  }

  const whisperForm = new FormData();
  whisperForm.set("file", audio);
  whisperForm.set("model", "whisper-1");
  whisperForm.set("language", "en");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: whisperForm
  });

  if (!response.ok) {
    const failure = await response.text();
    return NextResponse.json({ ok: false, error: failure }, { status: 500 });
  }

  const result = (await response.json()) as { text?: string };
  return NextResponse.json({ ok: true, transcript: result.text ?? "" });
}
