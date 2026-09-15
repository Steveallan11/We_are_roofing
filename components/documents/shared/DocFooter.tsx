import { DOC } from "@/lib/theme/documentTheme";
import type { Business } from "@/lib/types";

export function DocFooter({ business }: { business: Business }) {
  return (
    <footer style={{ alignItems: "center", background: DOC.white, borderTop: `1px solid ${DOC.lightRule}`, color: DOC.muted, padding: "18px 42px", display: "flex", justifyContent: "space-between", gap: 20, fontFamily: DOC.fontSans, fontSize: 10 }}>
      <span>{business.trading_address}</span>
      <span>{business.phone} | {business.email}</span>
      <span>{business.website}</span>
    </footer>
  );
}
