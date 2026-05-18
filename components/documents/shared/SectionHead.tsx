import { DOC } from "@/lib/theme/documentTheme";

export function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 12px" }}>
      <h2 style={{ margin: 0, color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {children}
      </h2>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${DOC.gold}, transparent)` }} />
    </div>
  );
}
