import OpenAI from "openai";
import type { ExtractedFrame } from "@/lib/survey/frameExtractor";

type SurveyContext = {
  jobTitle?: string | null;
  propertyAddress?: string | null;
  customerName?: string | null;
};

const SURVEY_ANALYSIS_SCHEMA = `{
  "visual_summary": "what is visibly shown in the video frames",
  "audio_summary": "what the surveyor says in the transcript",
  "job_understanding": "combined understanding of the job, defects, likely cause, access, and next works",
  "roof_type": "string",
  "has_flat_section": boolean,
  "flat_section_type": "string or null",
  "overall_condition": "Good|Fair|Poor|Critical",
  "condition_confidence": 0,
  "sections": [{"name":"string","material":"string","condition":"Good|Fair|Poor|Critical","confidence":0,"findings":["string"]}],
  "features": {"chimney":{"present":false,"condition":"string or null"},"skylights":{"count":0,"type":"string or null"},"soil_pipes":0,"gutters":{"condition":"string"},"solar_panels":false,"roof_windows":0},
  "problems": "detailed string",
  "suspected_cause": "string",
  "scaffold_required": true,
  "scaffold_notes": "string",
  "safety_concerns": "string or null",
  "recommendations": "numbered list string",
  "measurements": "measurements seen or spoken, or empty string",
  "access_notes": "access, parking, ladder, scaffold or site constraints, or empty string",
  "customer_concerns": "customer reported concerns from voice notes, or empty string",
  "weather_notes": "weather/site condition comments, or empty string",
  "field_confidence": {
    "survey_type": 0,
    "roof_type": 0,
    "roof_condition": 0,
    "problem_observed": 0,
    "suspected_cause": 0,
    "recommended_works": 0,
    "measurements": 0,
    "access_notes": 0,
    "scaffold_required": 0,
    "safety_notes": 0
  },
  "review_items": [{"field":"string","reason":"why Andy should review it","evidence":"what was seen or heard","confidence":0}],
  "overall_confidence": 0,
  "manual_review_needed": ["fields needing human check"]
}`;

export async function analyseFramesWithOpenAI(frames: ExtractedFrame[], transcript: string, context: SurveyContext = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for video survey transcription and vision analysis.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_SURVEY_VISION_MODEL || "gpt-4o-mini";

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert UK roofing surveyor's AI assistant. Analyse roof survey video frames alongside spoken site notes. Use the images for visual understanding, use the transcript for surveyor intent and details, and reconcile both before filling the survey. Fill as much of the survey as can be supported by evidence. Mark any field that is uncertain, hidden, not captured, contradicted, or dependent on measurement as needing review. Return valid JSON only."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyse these ${frames.length} roof survey frames plus the surveyor notes below.

Job context:
- Job title: ${context.jobTitle || "Unknown"}
- Property address: ${context.propertyAddress || "Unknown"}
- Customer: ${context.customerName || "Unknown"}

Voice notes: "${transcript || "No spoken transcript captured."}"

Return this JSON structure exactly:
${SURVEY_ANALYSIS_SCHEMA}`
          },
          ...frames.map((frame) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:image/jpeg;base64,${frame.base64}`,
              detail: "high" as const
            }
          }))
        ]
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI did not return a survey analysis payload.");
  }

  return JSON.parse(content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()) as Record<string, any>;
}
