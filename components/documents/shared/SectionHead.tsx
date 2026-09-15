import { DOC } from "@/lib/theme/documentTheme";

export function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ alignItems: "stretch", display: "flex", gap: 12, margin: "32px 0 14px" }}>
      <div style={{ background: DOC.gold, width: 4 }} />
      <h2 style={{ margin: 0, color: DOC.body, fontFamily: DOC.fontSans, fontSize: 19, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
        {children}
      </h2>
    </div>
  );
}
