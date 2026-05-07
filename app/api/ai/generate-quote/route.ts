import { NextResponse } from "next/server";
import { getJobBundle, getKnowledgeBase } from "@/lib/data";
import { generateQuoteFromBundle } from "@/lib/quote";

export async function POST(request: Request) {
  const body = (await request.json()) as { job_id?: string };
  if (!body.job_id) {
    return NextResponse.json({ ok: false, error: "job_id is required" }, { status: 400 });
  }

  const bundle = await getJobBundle(body.job_id);
  if (!bundle) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const knowledge = await getKnowledgeBase();
  const quote = await generateQuoteFromBundle(bundle, knowledge);

  return NextResponse.json({
    ok: true,
    quote,
    next_job_status: "Quote Drafted"
  });
}

