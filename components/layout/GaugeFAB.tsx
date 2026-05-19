"use client";

import { usePathname } from "next/navigation";

function GaugeIcon() {
  return (
    <svg aria-hidden="true" fill="none" height={22} stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={22}>
      <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

export function GaugeFAB() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/quote/")) return null;

  return (
    <button
      aria-label="Ask Gauge"
      className="gauge-mobile-fab no-print lg:hidden"
      onClick={() => window.dispatchEvent(new CustomEvent("gauge:prompt", { detail: { prompt: "" } }))}
      type="button"
    >
      <GaugeIcon />
    </button>
  );
}
