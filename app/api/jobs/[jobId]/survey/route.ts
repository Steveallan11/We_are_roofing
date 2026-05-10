import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, { params }: Props) {
  return saveSurvey(request, params);
}

export async function PUT(request: NextRequest, { params }: Props) {
  return saveSurvey(request, params);
}

async function saveSurvey(request: NextRequest, paramsPromise: Promise<{ jobId: string }>) {
  try {
    const { jobId } = await paramsPromise;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Extract core fields, everything else goes into adaptive_sections
    const coreKeys = ["surveyor_name","access_notes","scaffold_required","scaffold_notes","roof_condition","problem_observed","suspected_cause","recommended_works","measurements","weather_notes","safety_notes","customer_concerns","raw_notes","survey_type","no_photo_confirmation"];
    const core: Record<string, unknown> = {};
    const adaptive: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(body)) {
      if (coreKeys.includes(k)) { core[k] = v; }
      else if (k.startsWith("flat_")) { if (!adaptive.flat_roof) adaptive.flat_roof = {}; (adaptive.flat_roof as any)[k] = v; }
      else if (k.startsWith("p_") || k.startsWith("pitched_")) { if (!adaptive.pitched_roof) adaptive.pitched_roof = {}; (adaptive.pitched_roof as any)[k] = v; }
      else if (k.startsWith("f_") || k.startsWith("fascia_") || k.startsWith("soffit_") || k.startsWith("guttering_") || k.startsWith("downpipe_")) { if (!adaptive.fascias) adaptive.fascias = {}; (adaptive.fascias as any)[k] = v; }
      else if (k.startsWith("c_") || k.startsWith("chimney_") || k.startsWith("lead_") || k.startsWith("flaunching_")) { if (!adaptive.chimney) adaptive.chimney = {}; (adaptive.chimney as any)[k] = v; }
    }

    const surveyPayload = {
      job_id: jobId,
      ...core,
      adaptive_sections: adaptive,
      updated_at: new Date().toISOString(),
    };

    // Check for existing survey
    const { data: existing } = await supabase
      .from("surveys")
      .select("id")
      .eq("job_id", jobId)
      .limit(1)
      .maybeSingle();

    const result = existing
      ? await supabase.from("surveys").update(surveyPayload).eq("id", existing.id).select().single()
      : await supabase.from("surveys").insert(surveyPayload).select().single();

    if (result.error) {
      console.error("Survey save error:", result.error);
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
    }

    // Update job status
    const nextStatus = core.no_photo_confirmation ? "Ready For AI Quote" : "Survey Complete";
    await supabase.from("jobs").update({
      status: nextStatus,
      survey_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    return NextResponse.json({ ok: true, survey: result.data });
  } catch (err) {
    console.error("Survey error:", err);
    return NextResponse.json({ ok: false, error: "Failed to save survey" }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const { jobId } = await params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("surveys").select("*").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
