"use client";

import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      style={{
        alignItems: "center",
        background: "transparent",
        border: "1px solid var(--border-mid)",
        borderRadius: 6,
        color: "var(--text-muted)",
        cursor: "pointer",
        display: "flex",
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        fontWeight: 600,
        gap: compact ? 0 : 8,
        justifyContent: "center",
        padding: compact ? 6 : "6px 12px",
        width: compact ? 34 : "100%"
      }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
        {isDark ? (
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 100 14A7 7 0 0012 5z" />
        ) : (
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        )}
      </svg>
      {!compact ? <span>{isDark ? "Light mode" : "Dark mode"}</span> : null}
    </button>
  );
}
