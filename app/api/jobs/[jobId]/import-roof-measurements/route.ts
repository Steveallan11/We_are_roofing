import { NextResponse } from "next/server";
import { getLatestRoofSurvey } from "@/lib/roof-surveys";
import { requireAdminSession } from "@/lib/auth";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_req: Request, { params }: Params) {
  await requireAdminSession();
  const { jobId } = await params;

  const survey = await getLatestRoofSurvey(jobId);
  if (!survey || (!survey.lines?.length && !survey.sections?.length)) {
    return NextResponse.json({ ok: false, error: "No roof takeoff found for this job." }, { status: 404 });
  }

  // Sum lines by type
  const lineTotals: Record<string, number> = {};
  for (const line of survey.lines ?? []) {
    const type = line.type?.trim() ?? "Other";
    lineTotals[type] = (lineTotals[type] ?? 0) + (line.length_lm ?? 0);
  }

  // Sum sections area
  const totalArea = (survey.sections ?? []).reduce((sum, s) => sum + (s.area_m2 ?? 0), 0);

  // Map to survey measurement fields
  const measurements = {
    ridge_length_m: lineTotals["Ridge"] ? parseFloat(lineTotals["Ridge"].toFixed(2)) : null,
    eaves_length_m: lineTotals["Eaves"] ? parseFloat(lineTotals["Eaves"].toFixed(2)) : null,
    verge_length_m: lineTotals["Verge"] ? parseFloat(lineTotals["Verge"].toFixed(2)) : null,
    total_hip_metres: lineTotals["Hip"] ? parseFloat(lineTotals["Hip"].toFixed(2)) : null,
    total_valley_metres: lineTotals["Valley"] ? parseFloat(lineTotals["Valley"].toFixed(2)) : null,
    roof_area_override_m2: totalArea > 0 ? parseFloat(totalArea.toFixed(2)) : null,
    // Summary of all line types for context
    line_breakdown: Object.entries(lineTotals)
      .filter(([, v]) => v > 0)
      .map(([type, total]) => `${type}: ${total.toFixed(1)}m`)
      .join(", ")
  };

  return NextResponse.json({ ok: true, measurements, survey_id: survey.id });
}
