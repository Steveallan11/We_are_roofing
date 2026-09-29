import { describe, expect, it } from "vitest";
import { assertEmailAttachmentLimit } from "@/lib/comms/literatureAttachments";

describe("email attachment safety", () => {
  it("allows combined job documents and literature up to 25 MB", () => {
    const content = Buffer.alloc(25 * 1024 * 1024).toString("base64");
    expect(() => assertEmailAttachmentLimit([{ filename: "invoice.pdf", content, contentType: "application/pdf" }])).not.toThrow();
  });

  it("rejects a combined attachment payload over 25 MB", () => {
    const first = Buffer.alloc(13 * 1024 * 1024).toString("base64");
    const second = Buffer.alloc(13 * 1024 * 1024).toString("base64");
    expect(() => assertEmailAttachmentLimit([
      { filename: "invoice.pdf", content: first },
      { filename: "roof-report.pdf", content: second }
    ])).toThrow("25 MB");
  });
});
