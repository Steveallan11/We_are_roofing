import { DOC } from "@/lib/theme/documentTheme";

type Props = {
  label: string;
  lines: Array<string | null | undefined>;
};

export function AddressBlock({ label, lines }: Props) {
  const visible = lines.filter(Boolean);
  return (
    <div style={{ border: `1px solid ${DOC.lightRule}`, background: "#fffdf8", borderRadius: 14, padding: 16 }}>
      <div style={{ color: DOC.gold, fontFamily: DOC.fontSans, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
        {label}
      </div>
      {visible.map((line) => (
        <p key={line} style={{ margin: "2px 0", color: DOC.body, fontFamily: DOC.fontSerif, fontSize: 16, lineHeight: 1.45 }}>
          {line}
        </p>
      ))}
    </div>
  );
}
