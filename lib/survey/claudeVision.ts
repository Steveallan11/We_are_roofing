import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedFrame } from "@/lib/survey/frameExtractor";

export async function analyseFramesWithClaude(frames: ExtractedFrame[], transcript: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for video survey analysis.");
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2200,
    system:
      "You are an expert UK roofing surveyor's AI assistant. Analyse roof survey video frames alongside the spoken site notes. Be specific, practical, and use correct UK roofing terminology. If anything is uncertain, say so, but still provide the best grounded assessment. Return valid JSON only.",
    messages: [
      {
        role: "user",
        content: [
          ...frames.map((frame) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: "image/jpeg" as const,
              data: frame.base64
            }
          })),
          {
            type: "text" as const,
            text: `Analyse these ${frames.length} roof survey frames plus the surveyor notes below.

Voice notes: "${transcript}"

Return this JSON structure exactly:
{
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
  "overall_confidence": 0,
  "manual_review_needed": ["fields needing human check"]
}`
          }
        ]
      }
    ]
  });

  const text = response.content.find((item) => item.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Claude did not return a text analysis payload.");
  }

  return JSON.parse(text.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()) as Record<string, any>;
}
