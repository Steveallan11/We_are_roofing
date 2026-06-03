"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { JobForAction } from "@/lib/jobs/nextAction";

interface JobSearchDialogProps {
  jobs: JobForAction[];
  isOpen: boolean;
  onClose: () => void;
}

export function JobSearchDialog({ jobs, isOpen, onClose }: JobSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = query.trim()
    ? jobs.filter(
        (job) =>
          (job.job_ref?.toLowerCase() ?? "").includes(query.toLowerCase()) ||
          (job.job_title?.toLowerCase() ?? "").includes(query.toLowerCase()) ||
          (job.customer?.full_name?.toLowerCase() ?? "").includes(query.toLowerCase()) ||
          (job.property_address?.toLowerCase() ?? "").includes(query.toLowerCase())
      )
    : jobs.filter((job) => !["Completed", "Not Proceeding", "Lost", "Archived"].includes(job.status));

  const selectedJob = results[selectedIndex] ?? null;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev === 0 ? Math.max(0, results.length - 1) : prev - 1));
      } else if (e.key === "Enter" && selectedJob) {
        window.location.href = `/jobs/${selectedJob.id}`;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedJob, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-16 md:pt-20">
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] p-4">
          <input
            autoFocus
            className="w-full bg-transparent text-lg font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs by ref, name, customer, or address..."
            type="text"
            value={query}
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[var(--text-muted)]">No jobs found. Try a different search term.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {results.map((job, idx) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}` as Route}
                  onClick={onClose}
                  className={`block p-4 transition-colors ${
                    idx === selectedIndex ? "bg-[var(--gold)]/10" : "hover:bg-black/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--text)]">
                        {job.job_ref ?? "WR-J-TBC"} · {job.job_title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-1">
                        {job.customer?.full_name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
                        {job.property_address}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className="inline-block px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `var(--${job.status.toLowerCase().replace(/\s+/g, "-")}-bg)`,
                          color: `var(--${job.status.toLowerCase().replace(/\s+/g, "-")})`
                        }}
                      >
                        {job.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] p-3 text-xs text-[var(--text-muted)]">
          <p>
            <span className="font-semibold">↑↓</span> navigate • <span className="font-semibold">⏎</span> open •{" "}
            <span className="font-semibold">ESC</span> close
          </p>
        </div>
      </div>
    </div>
  );
}
