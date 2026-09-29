import { describe, expect, it } from "vitest";
import { invoiceSentEmail } from "../../lib/email/templates";

const baseInvoice = {
  customerName: "Clare & Brian Linden",
  invoiceRef: "WR-INV-1001",
  invoiceUrl: "https://example.com/invoice",
  jobTitle: "Pitched Roof Replacement",
  propertyAddress: "5 Scarth Road",
  dueDate: "24 September 2026",
  total: 6000
};

describe("invoice email wording", () => {
  it("uses the edited message in the branded invoice email", () => {
    const html = invoiceSentEmail({
      ...baseInvoice,
      messageBody: "Please review this stage invoice.\n\nCall us if you would like to discuss it."
    });

    expect(html).toContain("Please review this stage invoice.");
    expect(html).toContain("Call us if you would like to discuss it.");
    expect(html).toContain("VIEW INVOICE");
  });

  it("escapes customer-entered email wording", () => {
    const html = invoiceSentEmail({ ...baseInvoice, messageBody: "Thanks <script>alert('x')</script>" });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
