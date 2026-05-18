import { DOC } from "@/lib/theme/documentTheme";
import type { Business } from "@/lib/types";

export function DocFooter({ business }: { business: Business }) {
  return (
    <footer style={{ background: DOC.dark, color: "#d8d1bd", padding: "22px 38px", display: "flex", justifyContent: "space-between", gap: 24, fontFamily: DOC.fontSans, fontSize: 11 }}>
      <span>{business.trading_address}</span>
      <span>{business.phone} · {business.email}</span>
      <span>{business.website}</span>
    </footer>
  );
}
