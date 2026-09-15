import { DOC } from "@/lib/theme/documentTheme";
import { paragraphStyle } from "@/components/documents/shared/DocumentFrame";

export function DocumentGuide({ items }: { items: string[] }) {
  return (
    <div style={{ marginTop: 22 }}>
      <p style={eyebrowStyle}>Document guide</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, background: DOC.lightRule, border: `1px solid ${DOC.lightRule}` }}>
        {items.map((item, index) => (
          <div key={item} style={{ alignItems: "center", background: index === 0 ? "#fbf6e8" : DOC.white, display: "flex", minHeight: 44 }}>
            <span style={{ alignItems: "center", alignSelf: "stretch", background: DOC.gold, color: DOC.white, display: "flex", fontFamily: DOC.fontSans, fontSize: 12, fontWeight: 800, justifyContent: "center", minWidth: 42 }}>
              {index + 1}
            </span>
            <span style={{ color: DOC.body, fontFamily: DOC.fontSans, fontSize: 12, fontWeight: 700, padding: "10px 12px" }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocumentCallout({ children, eyebrow, title, tone = "gold" }: { children: React.ReactNode; eyebrow?: string; title?: string; tone?: "gold" | "dark" | "success" }) {
  const dark = tone === "dark";
  const accent = tone === "success" ? "#15803d" : DOC.gold;
  return (
    <div style={{ background: dark ? DOC.dark : "#fbf6e8", border: `1px solid ${dark ? DOC.dark : DOC.lightRule}`, borderLeft: `5px solid ${accent}`, margin: "22px 0", padding: "16px 18px" }}>
      {eyebrow ? <p style={{ ...eyebrowStyle, color: dark ? DOC.gold : accent, marginBottom: title ? 6 : 10 }}>{eyebrow}</p> : null}
      {title ? <h3 style={{ color: dark ? DOC.white : DOC.body, fontFamily: DOC.fontSans, fontSize: 18, lineHeight: 1.25, margin: "0 0 8px" }}>{title}</h3> : null}
      <div style={{ color: dark ? "#eee8d7" : DOC.body, fontFamily: DOC.fontSerif, fontSize: 15, lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

export function StructuredText({ fallback = "To be confirmed.", value }: { fallback?: string; value?: string | null }) {
  const blocks = parseDocumentText(value);
  if (!blocks.length) return <p style={bodyStyle}>{fallback}</p>;

  return (
    <div>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return <h3 key={`${block.text}-${index}`} style={{ color: DOC.body, fontFamily: DOC.fontSans, fontSize: 16, lineHeight: 1.3, margin: index === 0 ? "0 0 8px" : "20px 0 8px" }}>{block.text}</h3>;
        }
        if (block.type === "list") {
          return (
            <ul key={`list-${index}`} style={{ color: DOC.body, fontFamily: DOC.fontSerif, fontSize: 15, lineHeight: 1.62, margin: "8px 0 14px", paddingLeft: 24 }}>
              {block.items.map((item) => <li key={item} style={{ marginBottom: 4 }}>{item}</li>)}
            </ul>
          );
        }
        return <p key={`${block.text.slice(0, 24)}-${index}`} style={{ ...bodyStyle, margin: index === 0 ? "0 0 11px" : "11px 0" }}>{block.text}</p>;
      })}
    </div>
  );
}

type ParsedBlock = { type: "heading" | "paragraph"; text: string } | { type: "list"; items: string[] };

function parseDocumentText(value?: string | null): ParsedBlock[] {
  const text = value?.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const parsed: ParsedBlock[] = [];
  for (const rawBlock of text.split(/\n{2,}/)) {
    const lines = rawBlock.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const bulletLines = lines.filter((line) => /^([•*-]|\d+[.)])\s+/.test(line));
    if (bulletLines.length === lines.length) {
      parsed.push({ type: "list", items: lines.map((line) => line.replace(/^([•*-]|\d+[.)])\s+/, "")) });
      continue;
    }
    if (lines.length === 1 && isHeading(lines[0])) {
      parsed.push({ type: "heading", text: lines[0].replace(/:$/, "") });
      continue;
    }
    const joined = lines.join(" ");
    splitLongParagraph(joined).forEach((paragraph) => parsed.push({ type: "paragraph", text: paragraph }));
  }
  return parsed;
}

function isHeading(value: string) {
  return value.length <= 72 && !/[.!?]$/.test(value) && value.split(/\s+/).length <= 9;
}

function splitLongParagraph(text: string) {
  if (text.length < 390) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 320 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

const eyebrowStyle: React.CSSProperties = {
  color: DOC.gold,
  fontFamily: DOC.fontSans,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.16em",
  margin: "0 0 9px",
  textTransform: "uppercase"
};

const bodyStyle: React.CSSProperties = { ...paragraphStyle, fontSize: 15, lineHeight: 1.65 };
