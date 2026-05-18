import { DOC } from "@/lib/theme/documentTheme";

export type DocumentLineItem = {
  description: string;
  notes?: string;
  quantity?: string | number;
  unit?: string;
  amount?: string;
};

export function LineItemTable({ rows, totals }: { rows: DocumentLineItem[]; totals?: Array<{ label: string; value: string; strong?: boolean }> }) {
  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontFamily: DOC.fontSans }}>
        <thead>
          <tr style={{ background: DOC.dark }}>
            <th style={th}>Description</th>
            <th style={th}>Notes</th>
            <th style={{ ...th, textAlign: "right" }}>Qty</th>
            <th style={{ ...th, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.description}-${index}`} style={{ background: index % 2 ? "#fffdf8" : DOC.white }}>
              <td style={tdStrong}>{row.description}</td>
              <td style={td}>{row.notes || ""}</td>
              <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{[row.quantity, row.unit].filter(Boolean).join(" ")}</td>
              <td style={{ ...tdStrong, textAlign: "right", whiteSpace: "nowrap" }}>{row.amount || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totals?.length ? (
        <div style={{ width: "min(340px, 100%)", marginLeft: "auto", marginTop: 18, fontFamily: DOC.fontSans }}>
          {totals.map((total) => (
            <div key={total.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: `1px solid ${DOC.lightRule}`, color: total.strong ? DOC.gold : DOC.body, fontWeight: total.strong ? 800 : 600, fontSize: total.strong ? 18 : 13 }}>
              <span>{total.label}</span>
              <span>{total.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

const th: React.CSSProperties = {
  color: DOC.gold,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  padding: 12,
  textAlign: "left",
  textTransform: "uppercase"
};

const td: React.CSSProperties = {
  borderBottom: `1px solid ${DOC.lightRule}`,
  color: DOC.muted,
  fontFamily: DOC.fontSerif,
  fontSize: 14,
  lineHeight: 1.45,
  padding: 12,
  verticalAlign: "top"
};

const tdStrong: React.CSSProperties = {
  ...td,
  color: DOC.body,
  fontFamily: DOC.fontSans,
  fontWeight: 700
};
