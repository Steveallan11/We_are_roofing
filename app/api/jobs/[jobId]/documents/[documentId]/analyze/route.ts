import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string; documentId: string }>;
};

const ANALYZABLE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

type AnalysisResult = {
  summary: string;
  key_observations: string[];
  measurements?: Record<string, string>;
  recommended_actions: string[];
  confidence_level: "high" | "medium" | "low";
  document_type_inferred: string;
};

export async function POST(request: Request, { params }: Props) {
  const { jobId, documentId } = await params;

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Document analysis preview completed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OpenAI API key not configured" }, { status: 500 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createSupabaseAdminClient();

    // Get document record
    const { data: document, error: docError } = await supabase
      .from("job_documents")
      .select("*")
      .eq("id", documentId)
      .eq("job_id", jobId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    // Check if document type is analyzable
    if (!document.mime_type || !ANALYZABLE_MIME_TYPES.includes(document.mime_type)) {
      return NextResponse.json(
        { ok: false, error: `Document type ${document.mime_type} is not analyzable. Supported: images and PDFs` },
        { status: 400 }
      );
    }

    // Download document from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(document.storage_bucket)
      .download(document.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ ok: false, error: "Failed to download document for analysis" }, { status: 500 });
    }

    // Convert to base64 for OpenAI
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const mediaType = document.mime_type === "application/pdf" ? "application/pdf" : "image/jpeg";

    // Update status to pending
    await supabase
      .from("job_documents")
      .update({ analysis_status: "pending" })
      .eq("id", documentId);

    // Call OpenAI vision API
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Use REST API directly for vision since SDK might not fully support it
    const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${base64Data}`
                }
              },
              {
                type: "text",
                text: `You are analyzing a roofing technical document or drawing. Please provide a structured analysis in JSON format with the following fields:
- summary: Brief overview of what the document shows (string)
- key_observations: List of important findings from the document (array of strings)
- measurements: Any dimensions, areas, or specifications found (object with measurement name and value)
- recommended_actions: What actions should be taken based on this document (array of strings)
- confidence_level: How confident you are in your analysis (high/medium/low)
- document_type_inferred: What type of document this appears to be (string)

Return ONLY valid JSON with these fields.`
              }
            ]
          }
        ]
      })
    });

    if (!apiResponse.ok) {
      const error = await apiResponse.json();
      throw new Error(`OpenAI API error: ${error.error?.message || "Unknown error"}`);
    }

    const apiData = (await apiResponse.json()) as any;
    const responseText = apiData.choices?.[0]?.message?.content || "";

    // Parse the response
    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      // If parsing fails, create a basic analysis from the response
      analysis = {
        summary: responseText,
        key_observations: [],
        recommended_actions: [],
        confidence_level: "low",
        document_type_inferred: "Unknown"
      };
    }

    // Store analysis result
    const { error: updateError } = await supabase
      .from("job_documents")
      .update({
        analysis_data: analysis,
        analysis_status: "completed",
        analysis_created_at: new Date().toISOString()
      })
      .eq("id", documentId);

    if (updateError) {
      return NextResponse.json({ ok: false, error: "Failed to store analysis results" }, { status: 500 });
    }

    // Update job timestamp
    await supabase.from("jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);

    return NextResponse.json({
      ok: true,
      message: "Document analyzed successfully",
      analysis
    });
  } catch (error) {
    console.error("Document analysis error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to analyze document" },
      { status: 500 }
    );
  }
}
