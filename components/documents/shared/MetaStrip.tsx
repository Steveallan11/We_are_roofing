import { DOC } from "@/lib/theme/documentTheme";

export function MetaStrip({ items }: { items: Array<{ label: string; value: string | number | null | undefined }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`, gap: 10, margin: "22px 0" }}>
      {items.map((item) => (
        <div key={item.label} style={{ background: "#f2eddf", borderRadius: 12, padding: "12px 14px", border: `1px solid ${DOC.lightRule}` }}>
          <div style={{ color: DOC.muted, fontFamily: DOC.fontSans, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{item.label}</div>
          <div style={{ color: DOC.body, fontFamily: DOC.fontSans, fontSize: 13, fontWeight: 700, marginTop: 6 }}>{item.value ?? "TBC"}</div>
        </div>
      ))}
    </div>
  );
}
