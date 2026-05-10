"use client";
import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import type { JobStatus } from "@/lib/types";
import { StatusPill } from "@/components/ui/status-pill";
import { currency } from "@/lib/utils";

type JobWithRels = { id: string; job_title: string; property_address: string; roof_type?: string | null; status: JobStatus; estimated_value?: number | null; customer?: { full_name: string } | null };

const COLS: { status: JobStatus; bg: string }[] = [
  { status: "New Lead", bg: "rgba(124,227,166,0.2)" },
  { status: "Survey Needed", bg: "rgba(212,175,55,0.2)" },
  { status: "Survey Complete", bg: "rgba(212,175,55,0.3)" },
  { status: "Ready For AI Quote", bg: "rgba(245,208,96,0.25)" },
  { status: "Quote Drafted", bg: "rgba(245,208,96,0.35)" },
  { status: "Ready To Send", bg: "rgba(46,204,113,0.2)" },
  { status: "Quote Sent", bg: "rgba(46,204,113,0.3)" },
  { status: "Follow-Up Needed", bg: "rgba(231,76,60,0.2)" },
  { status: "Accepted", bg: "rgba(46,204,113,0.45)" },
  { status: "Materials Needed", bg: "rgba(155,89,182,0.25)" },
  { status: "Booked", bg: "rgba(52,152,219,0.25)" },
  { status: "Completed", bg: "rgba(46,204,113,0.12)" },
];

export function KanbanBoard({ initialJobs }: { initialJobs: JobWithRels[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [dragOver, setDragOver] = useState<JobStatus | null>(null);
  const dragId = useRef<string | null>(null);

  const onDragStart = useCallback((_e: React.DragEvent, id: string) => { dragId.current = id; }, []);

  const onDrop = useCallback(async (e: React.DragEvent, newStatus: JobStatus) => {
    e.preventDefault(); setDragOver(null);
    const id = dragId.current; if (!id) return;
    const old = [...jobs];
    setJobs(p => p.map(j => j.id === id ? { ...j, status: newStatus } : j));
    try {
      const res = await fetch("/api/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) });
      if (!res.ok) setJobs(old);
    } catch { setJobs(old); }
  }, [jobs]);

  return (
    <div className="overflow-x-auto pb-4 -mx-4 px-4">
      <div className="flex gap-3" style={{ minWidth: `${COLS.length * 240}px` }}>
        {COLS.map(col => {
          const colJobs = jobs.filter(j => j.status === col.status);
          return (
            <div key={col.status}
              onDrop={e => onDrop(e, col.status)}
              onDragOver={e => { e.preventDefault(); setDragOver(col.status); }}
              onDragLeave={() => setDragOver(null)}
              className={`flex flex-col min-w-[220px] w-[220px] shrink-0 rounded-2xl border transition ${dragOver === col.status ? "border-[var(--gold)]" : "border-[var(--border)]"}`}
            >
              <div className="rounded-t-2xl px-3 py-2 border-b border-[var(--border)]" style={{ background: col.bg }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-white">{col.status}</h3>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(0,0,0,0.3)] text-[9px] font-bold text-white">{colJobs.length}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 p-2 min-h-[80px] max-h-[55vh] overflow-y-auto">
                {colJobs.map(job => (
                  <div key={job.id} draggable onDragStart={e => onDragStart(e, job.id)} className="card p-2.5 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition">
                    <Link href={`/jobs/${job.id}`} className="block">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--gold)]">{job.roof_type ?? "Roofing"}</p>
                      <h4 className="font-condensed text-sm text-white mt-0.5 leading-tight">{job.job_title}</h4>
                      <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">{job.customer?.full_name ?? ""}</p>
                      {job.estimated_value && <p className="text-xs text-[var(--gold-l)] mt-1">{currency(job.estimated_value)}</p>}
                    </Link>
                  </div>
                ))}
                {colJobs.length === 0 && <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-center text-[10px] text-[var(--dim)]">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-[var(--dim)]">
        <span>{jobs.length} jobs</span>
        <span>Pipeline: {currency(jobs.reduce((s, j) => s + (j.estimated_value ?? 0), 0))}</span>
      </div>
    </div>
  );
}
