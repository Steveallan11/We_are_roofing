import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hydrateRoofSurvey } from "@/lib/roof-surveys";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ surveyId: string }>;
};

export async function GET(_: Request, { params }: Props) {
  const { surveyId } = await params;
  const survey = await hydrateRoofSurvey(surveyId);
  return NextResponse.json({ ok: true, survey });
}

export async function PUT(request: Request, { params }: Props) {
  const { surveyId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    project_name?: string;
    scale_px_per_m?: number | null;
    satellite_image_path?: string | null;
    notes?: string;
    status?: "draft" | "complete";
  };

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, survey: { id: surveyId, ...body } });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("roof_surveys")
    .update({
      ...body,
      updated_at: new Date().toISOString()
    })
    .eq("id", surveyId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unable to update the roof survey." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, survey: await hydrateRoofSurvey(surveyId) });
}

export async function DELETE(_: Request, { params }: Props) {
  const { surveyId } = await params;
  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("roof_surveys").delete().eq("id", surveyId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
