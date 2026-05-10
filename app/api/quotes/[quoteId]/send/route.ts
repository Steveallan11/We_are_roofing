import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.json({ ok: false, error: "Quote sending coming soon — Phase 2" }, { status: 501 });
}
