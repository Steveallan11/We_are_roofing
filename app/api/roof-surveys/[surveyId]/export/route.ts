import { NextResponse } from "next/server";
import { buildRoofSurveyBom, getRoofSurveyTotals } from "@/lib/survey/geometry";
import { hydrateRoofSurvey } from "@/lib/roof-surveys";

type Props = {
  params: Promise<{ surveyId: string }>;
};

export async function GET(_: Request, { params }: Props) {
  const { surveyId } = await params;
  const survey = await hydrateRoofSurvey(surveyId);
  const bom = buildRoofSurveyBom(survey);
  const totals = getRoofSurveyTotals(survey);
  return NextResponse.json({ ok: true, survey, bom, totals });
}
