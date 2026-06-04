"use client";

import { useEffect, useRef, useState } from "react";

type JobOption = {
  id: string;
  job_ref: string | null;
  job_title: string;
  property_address: string | null;
  customer_name: string;
};

type Props = {
  value: string;
  onChange: (jobId: string, label?: string) => void;
};

export function JobPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<JobOption[]>([]);
  const [recent, setRecent] = useState<JobOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/jobs?limit=8`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok) setRecent(data.jobs ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/jobs?limit=10&q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          if (data?.ok) setOptions(data.jobs ?? []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const formatLabel = (job: JobOption) =>
    `${job.job_ref ? `[${job.job_ref}] ` : ""}${job.job_title} — ${job.customer_name}`;

  const handleSelect = (job: JobOption) => {
    const label = formatLabel(job);
    setSelectedLabel(label);
    setQuery("");
    setOpen(false);
    onChange(job.id, label);
  };

  const clear = () => {
    setSelectedLabel("");
    setQuery("");
    onChange("", "");
  };

  const list = query.trim() ? options : recent;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-[var(--text)]">Link to job (optional)</label>
      {value && selectedLabel ? (
        <div className="mt-1 flex items-center justify-between rounded border border-[var(--border)] bg-[var(--ink)] px-3 py-2">
          <span className="truncate text-sm text-[var(--text)]">{selectedLabel}</span>
          <button type="button" onClick={clear} className="ml-2 text-xs text-[var(--text-muted)] hover:text-[#fca5a5]">
            Remove
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search jobs by ref, title, or address"
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
        />
      )}

      {open && !value && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">Searching…</p>
          ) : list.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">
              {query.trim() ? "No matching jobs." : "Type to search jobs."}
            </p>
          ) : (
            <>
              {!query.trim() && (
                <p className="border-b border-[var(--border)] px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Recent jobs
                </p>
              )}
              {list.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => handleSelect(job)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--ink)]"
                >
                  <div className="font-medium text-[var(--text)]">
                    {job.job_ref ? <span className="text-[var(--gold)]">[{job.job_ref}]</span> : null} {job.job_title}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {job.customer_name}
                    {job.property_address ? ` · ${job.property_address}` : ""}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
