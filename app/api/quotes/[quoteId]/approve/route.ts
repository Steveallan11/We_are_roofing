import { NextResponse } from "next/server";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export async function POST(_request: Request, { params }: Props) {
  const { quoteId } = await params;
  return NextResponse.json({
    ok: true,
    quoteId,
    message: "Approve quote endpoint scaffolded.",
    next_job_status: "Ready To Send",
    next_quote_status: "Approved"
  });
}

