"use client";

import Link from "next/link";
import type { Route } from "next";

type Props = {
  backHref: string;
  pdfHref?: string | null;
};

export function DocumentPreviewToolbar({ backHref, pdfHref }: Props) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
      <Link className="button-ghost" href={backHref as Route}>
        Back to Job
      </Link>
      <div className="flex flex-wrap gap-2">
        <button className="button-secondary" onClick={() => globalThis.print()} type="button">
          Print / Save PDF
        </button>
        {pdfHref ? (
          <a className="button-primary" href={pdfHref} rel="noreferrer" target="_blank">
            Open Filed PDF
          </a>
        ) : null}
      </div>
    </div>
  );
}
