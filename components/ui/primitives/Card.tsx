import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "raised" | "outlined" | "flat";
type CardPadding = "none" | "sm" | "md" | "lg";

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: "border border-[var(--border)] bg-[var(--surface)]",
  raised: "border border-[var(--border)] bg-[var(--elevated)] shadow-md",
  outlined: "border border-[var(--border-mid)] bg-transparent",
  flat: "border-0 bg-[var(--surface-hover)]"
};

const PADDING_CLASS: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-5"
};

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", padding = "md", interactive = false, className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl overflow-hidden",
        VARIANT_CLASS[variant],
        PADDING_CLASS[padding],
        interactive && "transition-colors duration-150 hover:border-[var(--border-mid)] cursor-pointer",
        className
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex items-start justify-between gap-3", className)} {...props} />;
  }
);

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn("font-condensed text-xl text-[var(--text)] leading-tight", className)}
        {...props}
      />
    );
  }
);

export const CardKicker = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function CardKicker({ className, ...props }, ref) {
    return (
      <p
        ref={ref}
        className={cn(
          "text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--dim)]",
          className
        )}
        {...props}
      />
    );
  }
);

export const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardBody({ className, ...props }, ref) {
    return <div ref={ref} className={cn("text-sm text-[var(--text-second)]", className)} {...props} />;
  }
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3 mt-3", className)}
        {...props}
      />
    );
  }
);
