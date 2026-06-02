import * as React from "react";
import { cn } from "@/lib/utils";

const FIELD_BASE =
  "block w-full min-h-[44px] rounded-lg border border-[var(--border-mid)] bg-[var(--surface-deep)] px-3 py-2.5 text-base text-[var(--text-second)] placeholder:text-[var(--text-faint)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

type FieldShellProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
};

export function FieldShell({ label, hint, error, required, children, className, htmlFor }: FieldShellProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
          {required ? <span className="ml-0.5 text-[var(--stage-alert-text)]">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-[var(--stage-alert-text)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--text-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  containerClassName?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, containerClassName, className, id, ...props },
  ref
) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const hasLabel = Boolean(label || hint || error);

  const input = (
    <input
      ref={ref}
      id={inputId}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(FIELD_BASE, error && "border-[var(--stage-alert)]", className)}
      {...props}
    />
  );

  if (!hasLabel) return input;

  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={containerClassName}>
      {input}
    </FieldShell>
  );
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  containerClassName?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, containerClassName, className, id, rows = 4, ...props },
  ref
) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  const hasLabel = Boolean(label || hint || error);

  const textarea = (
    <textarea
      ref={ref}
      id={textareaId}
      rows={rows}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(FIELD_BASE, "min-h-[88px] resize-y", error && "border-[var(--stage-alert)]", className)}
      {...props}
    />
  );

  if (!hasLabel) return textarea;

  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={textareaId} className={containerClassName}>
      {textarea}
    </FieldShell>
  );
});

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  containerClassName?: string;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, containerClassName, className, id, children, ...props },
  ref
) {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;
  const hasLabel = Boolean(label || hint || error);

  const select = (
    <select
      ref={ref}
      id={selectId}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(FIELD_BASE, "pr-9 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat", error && "border-[var(--stage-alert)]", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")"
      }}
      {...props}
    >
      {children}
    </select>
  );

  if (!hasLabel) return select;

  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={selectId} className={containerClassName}>
      {select}
    </FieldShell>
  );
});
