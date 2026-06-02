"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type DataListColumn<T> = {
  key: string;
  header: React.ReactNode;
  /** Cell renderer for desktop table */
  cell: (row: T, index: number) => React.ReactNode;
  /** Optional: cell renderer for mobile card (defaults to `cell`) */
  mobileCell?: (row: T, index: number) => React.ReactNode;
  /** Render this column as the primary label on the mobile card */
  mobilePrimary?: boolean;
  /** Hide this column entirely on mobile cards */
  hideOnMobile?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
  className?: string;
};

export type DataListProps<T> = {
  columns: DataListColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  className?: string;
  /** Per-row action area shown on mobile cards (e.g., actions menu) */
  mobileActions?: (row: T) => React.ReactNode;
};

const ALIGN_CLASS = {
  left: "text-left",
  right: "text-right",
  center: "text-center"
} as const;

export function DataList<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
  mobileActions
}: DataListProps<T>) {
  if (rows.length === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed border-[var(--border-mid)] p-8 text-center text-sm text-[var(--text-muted)]", className)}>
        {empty ?? "No data to display."}
      </div>
    );
  }

  const mobileColumns = columns.filter((col) => !col.hideOnMobile);
  const primaryCol = mobileColumns.find((c) => c.mobilePrimary) ?? mobileColumns[0];
  const secondaryCols = mobileColumns.filter((c) => c.key !== primaryCol?.key);

  return (
    <>
      {/* Desktop table */}
      <div className={cn("hidden lg:block overflow-x-auto rounded-xl border border-[var(--border)]", className)}>
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]",
                    ALIGN_CLASS[col.align ?? "left"]
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-[var(--border)] last:border-b-0",
                  onRowClick && "cursor-pointer hover:bg-[var(--surface-hover)]"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3 text-[var(--text-second)]", ALIGN_CLASS[col.align ?? "left"], col.className)}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className={cn("lg:hidden space-y-2", className)}>
        {rows.map((row, index) => {
          const key = rowKey(row, index);
          const cardContent = (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {primaryCol ? (
                    <div className="font-semibold text-[var(--text)] text-sm">
                      {(primaryCol.mobileCell ?? primaryCol.cell)(row, index)}
                    </div>
                  ) : null}
                  <div className="mt-2 space-y-1">
                    {secondaryCols.map((col) => (
                      <div key={col.key} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-[var(--text-faint)] uppercase tracking-wider">{col.header}</span>
                        <span className="text-[var(--text-second)] text-right min-w-0">
                          {(col.mobileCell ?? col.cell)(row, index)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {mobileActions ? <div className="shrink-0">{mobileActions(row)}</div> : null}
              </div>
            </div>
          );

          if (onRowClick) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => onRowClick(row)}
                className="block w-full text-left transition-colors hover:bg-[var(--surface-hover)] rounded-xl"
              >
                {cardContent}
              </button>
            );
          }
          return <div key={key}>{cardContent}</div>;
        })}
      </div>
    </>
  );
}
