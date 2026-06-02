"use client";

import { useState } from "react";
import { DocumentAnalysisCard } from "./DocumentAnalysisCard";
import type { JobDocumentRecord } from "@/lib/types";
import { getJobDocumentHref } from "@/lib/documents";
import { formatDate } from "@/lib/utils";

type Props = {
  jobId: string;
  documents: JobDocumentRecord[];
  documentGroups: Record<string, JobDocumentRecord[]>;
};

export function JobDocumentsSection({ jobId, documents, documentGroups }: Props) {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const handleAnalyze = async (documentId: string) => {
    setAnalyzingId(documentId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/documents/${documentId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze document");
      }

      // Refresh the page to show updated analysis
      window.location.reload();
    } catch (error) {
      console.error("Error analyzing document:", error);
      alert(error instanceof Error ? error.message : "Failed to analyze document");
      setAnalyzingId(null);
    }
  };

  return (
    <div className="mt-4 grid gap-3">
      {documents.length > 0 ? (
        Object.entries(documentGroups).map(([group, groupDocuments]) =>
          groupDocuments.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-3" key={group}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-d)]">{group}</p>
                <span className="text-xs text-[var(--muted)]">{groupDocuments.length} file{groupDocuments.length === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-3 space-y-2">
                {groupDocuments.map((document) => (
                  <div key={document.id}>
                    <div className="rounded-xl border border-[var(--border)] bg-black/20 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{document.display_name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {getDocumentDisplayType(document)}
                            {document.created_at ? ` | Added ${formatDate(document.created_at)}` : ""}
                            {document.file_size ? ` | ${formatFileSize(document.file_size)}` : ""}
                          </p>
                        </div>
                        <a
                          className="inline-flex shrink-0 text-sm font-semibold text-[var(--gold-l)] underline-offset-4 hover:underline"
                          href={getJobDocumentHref(document)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open document
                        </a>
                      </div>
                    </div>
                    <DocumentAnalysisCard
                      document={document}
                      onAnalyze={handleAnalyze}
                      isAnalyzing={analyzingId === document.id}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )
      ) : (
        <p className="text-sm text-[var(--muted)]">Generated quote documents and supporting files will appear here.</p>
      )}
    </div>
  );
}

function getDocumentDisplayType(document: JobDocumentRecord): string {
  if (document.document_type.includes("survey")) return "Survey Document";
  if (document.document_type.includes("quote")) return "Quote Document";
  if (document.document_type.includes("invoice")) return "Invoice";
  const typeLabel = document.document_type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return typeLabel || "Uploaded Document";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
