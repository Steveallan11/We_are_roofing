import { NextResponse } from "next/server";
import { getAssistantStatus } from "@/lib/assistant/toolHandlers";

export async function GET() {
  const status = await getAssistantStatus();
  return NextResponse.json({ ok: true, ...status });
}
