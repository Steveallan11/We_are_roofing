import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "border border-[var(--gold)] bg-[var(--gold)] text-black font-bold hover:bg-[var(--gold-light)] hover:border-[var(--gold-light)]",
  secondary:
    "border border-[var(--border-mid)] bg-[var(--elevated)] text-[var(--text-second)] font-semibold hover:border-[var(--gold)] hover:text-[var(--gold)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--text-muted)] font-semibold hover:bg-[var(--elevated)] hover:text-[var(--text-second)]",
  destructive:
    "border border-[var(--stage-alert-border)] bg-[var(--stage-alert-bg)] text-[var(--stage-alert-text)] font-semibold hover:border-[var(--stage-alert)] hover:bg-[var(--stage-alert)] hover:text-white",
  subtle:
    "border border-[var(--border)] bg-transparent text-[var(--text-muted)] font-medium hover:border-[var(--border-mid)] hover:text-[var(--text-second)] hover:bg-[var(--elevated)]"
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3 text-xs rounded-md gap-1.5",
  md: "min-h-[44px] px-4 text-sm rounded-lg gap-2",
  lg: "min-h-[52px] px-5 text-base rounded-xl gap-2.5"
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    asChild = false,
    className,
    children,
    disabled,
    type,
    ...props
  },
  ref
) {
  const Comp = asChild ? Slot : "button";
  const isDisabled = disabled || loading;

  const content = asChild ? (
    children
  ) : (
    <>
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      ) : leftIcon ? (
        <span className="inline-flex shrink-0" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      <span className="inline-flex items-center">{children}</span>
      {!loading && rightIcon ? (
        <span className="inline-flex shrink-0" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </>
  );

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type ?? "button"}
      disabled={asChild ? undefined : isDisabled}
      data-loading={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center font-ui tracking-tight transition-all duration-150 cursor-pointer no-underline outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
        "active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {content}
    </Comp>
  );
});
