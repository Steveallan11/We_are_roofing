import { DOC } from "@/lib/theme/documentTheme";

export function DocumentFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="doc-preview" data-no-theme="true" style={{ background: DOC.bg, color: DOC.body, maxWidth: 820, margin: "0 auto", borderRadius: 18, overflow: "hidden", boxShadow: "0 12px 50px rgba(0,0,0,0.35)" }}>
      {children}
    </div>
  );
}

export function DocumentBody({ children }: { children: React.ReactNode }) {
  return <main style={{ background: DOC.white, padding: "30px 38px" }}>{children}</main>;
}

export const paragraphStyle: React.CSSProperties = {
  color: DOC.body,
  fontFamily: DOC.fontSerif,
  fontSize: 16,
  lineHeight: 1.72,
  margin: 0,
  whiteSpace: "pre-line"
};
