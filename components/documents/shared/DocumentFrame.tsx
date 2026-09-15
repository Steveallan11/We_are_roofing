import { DOC } from "@/lib/theme/documentTheme";

export function DocumentFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="doc-preview" data-no-theme="true" style={{ background: DOC.white, border: `1px solid ${DOC.lightRule}`, color: DOC.body, maxWidth: 850, margin: "0 auto", overflow: "hidden", boxShadow: "0 14px 48px rgba(0,0,0,0.28)" }}>
      {children}
    </div>
  );
}

export function DocumentBody({ children }: { children: React.ReactNode }) {
  return <main style={{ background: DOC.white, padding: "34px 42px 44px" }}>{children}</main>;
}

export const paragraphStyle: React.CSSProperties = {
  color: DOC.body,
  fontFamily: DOC.fontSerif,
  fontSize: 15,
  lineHeight: 1.65,
  margin: 0,
  whiteSpace: "pre-line"
};
