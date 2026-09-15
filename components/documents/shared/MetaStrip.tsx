import { DOC } from "@/lib/theme/documentTheme";

export function MetaStrip({ items }: { items: Array<{ label: string; value: string | number | null | undefined }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`, border: `1px solid ${DOC.lightRule}`, margin: "8px 0 24px" }}>
      {items.map((item) => (
        <div key={item.label} style={{ background: "#faf8f1", borderRight: `1px solid ${DOC.lightRule}`, minHeight: 58, padding: "12px 14px" }}>
          <div style={{ color: DOC.muted, fontFamily: DOC.fontSans, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{item.label}</div>
          <div style={{ color: DOC.body, fontFamily: DOC.fontSans, fontSize: 13, fontWeight: 700, lineHeight: 1.35, marginTop: 6 }}>{item.value ?? "TBC"}</div>
        </div>
      ))}
    </div>
  );
}
