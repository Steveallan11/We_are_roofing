import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createJobSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Job payload accepted.",
    customer_id: `cust-${randomUUID()}`,
    job_id: `job-${randomUUID()}`,
    next_status: "New Lead",
    received: parsed.data
  });
}
