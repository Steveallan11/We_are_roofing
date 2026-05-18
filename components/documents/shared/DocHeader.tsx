import { DOC } from "@/lib/theme/documentTheme";

type Props = {
  title: string;
  reference: string;
  subtitle?: string;
  meta?: string;
};

export function DocHeader({ title, reference, subtitle, meta }: Props) {
  return (
    <header style={{ background: DOC.dark, color: DOC.white, padding: "34px 38px", display: "flex", justifyContent: "space-between", gap: 28 }}>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="We Are Roofing UK Ltd" src="/we-are-roofing-logo.png" style={{ height: 72, objectFit: "contain", marginBottom: 18 }} />
        <div style={{ fontFamily: DOC.fontSans, fontSize: 11, color: DOC.gold, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 700 }}>
          We Are Roofing UK Ltd
        </div>
        {subtitle ? <p style={{ margin: "8px 0 0", color: "#d8d1bd", fontFamily: DOC.fontSerif, fontSize: 16 }}>{subtitle}</p> : null}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: DOC.fontSans, fontSize: 11, color: DOC.gold, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 700 }}>
          {reference}
        </div>
        <h1 style={{ margin: "10px 0 0", fontFamily: DOC.fontSerif, fontSize: 46, lineHeight: 1, fontWeight: 700 }}>{title}</h1>
        {meta ? <p style={{ margin: "12px 0 0", color: "#cfc7ae", fontFamily: DOC.fontSans, fontSize: 12 }}>{meta}</p> : null}
      </div>
    </header>
  );
}
