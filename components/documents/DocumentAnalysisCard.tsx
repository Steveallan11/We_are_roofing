"use client";

import { useState } from "react";
import type { JobDocumentRecord } from "@/lib/types";

type Props = {
  document: JobDocumentRecord;
  onAnalyze?: (documentId: string) => void;
  isAnalyzing?: boolean;
};

export function DocumentAnalysisCard({ document, onAnalyze, isAnalyzing }: Props) {
  const [expanded, setExpanded] = useState(false);

  const analysis = document.analysis_data as any;
  const isAnalyzable = document.mime_type && ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"].includes(document.mime_type);
  const isPending = document.analysis_status === "pending";
  const isCompleted = document.analysis_status === "completed";

  if (!isAnalyzable) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isCompleted && analysis ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-green-500">✓ Analyzed</span>
                {analysis.confidence_level && (
                  <span className="text-xs text-[var(--muted)]">Confidence: {analysis.confidence_level}</span>
                )}
              </div>
              {!expanded && analysis.summary && (
                <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{analysis.summary}</p>
              )}
            </>
          ) : isPending ? (
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--gold)] border-r-transparent" />
              <span className="text-xs font-semibold text-[var(--muted)]">Analyzing document...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted)]">No analysis yet</span>
              {isAnalyzable && onAnalyze && (
                <button
                  className="text-xs text-[var(--gold)] hover:underline"
                  onClick={() => onAnalyze(document.id)}
                  disabled={isAnalyzing}
                  type="button"
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze"}
                </button>
              )}
            </div>
          )}
        </div>
        {isCompleted && analysis && (
          <button
            className="shrink-0 text-xs text-[var(--muted)] hover:text-white transition"
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            {expanded ? "▼" : "▶"}
          </button>
        )}
      </div>

      {expanded && isCompleted && analysis && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          {analysis.summary && (
            <div>
              <p className="text-[0.65rem] font-bold uppercase text-[var(--dim)]">Summary</p>
              <p className="mt-1 text-xs text-[var(--text)]">{analysis.summary}</p>
            </div>
          )}

          {analysis.document_type_inferred && (
            <div>
              <p className="text-[0.65rem] font-bold uppercase text-[var(--dim)]">Document Type</p>
              <p className="mt-1 text-xs text-[var(--text)]">{analysis.document_type_inferred}</p>
            </div>
          )}

          {analysis.key_observations && analysis.key_observations.length > 0 && (
            <div>
              <p className="text-[0.65rem] font-bold uppercase text-[var(--dim)]">Key Observations</p>
              <ul className="mt-1 space-y-1">
                {analysis.key_observations.map((obs: string, i: number) => (
                  <li key={i} className="text-xs text-[var(--text)] flex gap-2">
                    <span className="shrink-0">•</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.measurements && Object.keys(analysis.measurements).length > 0 && (
            <div>
              <p className="text-[0.65rem] font-bold uppercase text-[var(--dim)]">Measurements</p>
              <div className="mt-1 grid gap-1 text-xs text-[var(--text)]">
                {Object.entries(analysis.measurements).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <span>{key}:</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
            <div>
              <p className="text-[0.65rem] font-bold uppercase text-[var(--dim)]">Recommended Actions</p>
              <ul className="mt-1 space-y-1">
                {analysis.recommended_actions.map((action: string, i: number) => (
                  <li key={i} className="text-xs text-[var(--text)] flex gap-2">
                    <span className="shrink-0">→</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
