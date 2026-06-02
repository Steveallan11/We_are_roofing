"use server";

export async function analyzeDocument(jobId: string, documentId: string) {
  try {
    const response = await fetch(`/api/jobs/${jobId}/documents/${documentId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to analyze document");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw error;
  }
}
