import { DOC } from "@/lib/theme/documentTheme";

type Props = {
  title: string;
  reference: string;
  subtitle?: string;
  meta?: string;
};

export function DocHeader({ title, reference, subtitle, meta }: Props) {
  return (
    <header style={{ background: DOC.white, borderTop: `7px solid ${DOC.gold}`, color: DOC.body, padding: "28px 42px 24px" }}>
      <div style={{ alignItems: "flex-start", display: "flex", justifyContent: "space-between", gap: 28 }}>
        <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="We Are Roofing UK Ltd" src="/we-are-roofing-logo.png" style={{ height: 64, maxWidth: 220, objectFit: "contain", objectPosition: "left center", marginBottom: 14 }} />
        <div style={{ fontFamily: DOC.fontSans, fontSize: 11, color: DOC.gold, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 700 }}>
          We Are Roofing UK Ltd
        </div>
        {subtitle ? <p style={{ margin: "7px 0 0", color: DOC.muted, fontFamily: DOC.fontSerif, fontSize: 14 }}>{subtitle}</p> : null}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: DOC.fontSans, fontSize: 10, color: DOC.muted, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>
            We Are Roofing UK Ltd&nbsp;&nbsp;|&nbsp;&nbsp;{reference}
          </div>
          <h1 style={{ margin: "13px 0 0", fontFamily: DOC.fontSerif, fontSize: 46, lineHeight: 0.95, fontWeight: 700 }}>{title}</h1>
          {meta ? <p style={{ margin: "12px 0 0", color: DOC.muted, fontFamily: DOC.fontSans, fontSize: 12 }}>{meta}</p> : null}
        </div>
      </div>
      <div style={{ background: `linear-gradient(90deg, ${DOC.gold}, ${DOC.lightRule} 65%, transparent)`, height: 1, marginTop: 22 }} />
    </header>
  );
}
