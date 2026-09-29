import { describe, expect, it } from "vitest";
import { bankFingerprintSource, classifyBankTransaction, normaliseBankDescription } from "@/lib/finance/bankStatements";

describe("bank statement staging", () => {
  it("normalises descriptions for stable duplicate fingerprints", () => {
    expect(normaliseBankDescription("  Travis-PERKINS / Fleet  ")).toBe("TRAVIS PERKINS FLEET");
    expect(bankFingerprintSource({ accountKey: "1234", date: "2026-09-01", amount: -120, description: "Travis Perkins", reference: "ABC" }))
      .toBe(bankFingerprintSource({ accountKey: "1234", date: "2026-09-01", amount: "-120.00", description: "TRAVIS-PERKINS", reference: "abc" }));
  });

  it("suggests common roofing categories without approving VAT or posting", () => {
    expect(classifyBankTransaction("Jewson Guildford", -450)).toMatchObject({ proposedType: "expense", category: "Materials", confidence: 90 });
    expect(classifyBankTransaction("ABC Scaffold Ltd", -1200)).toMatchObject({ proposedType: "expense", category: "Scaffold" });
  });

  it("keeps incoming money and unknown debits for review", () => {
    expect(classifyBankTransaction("Faster payment Clare Linden", 6000)).toMatchObject({ proposedType: "customer_payment" });
    expect(classifyBankTransaction("MISC PAYMENT", -33.25)).toMatchObject({ proposedType: "unmatched", confidence: 10 });
  });

  it("recognises likely internal transfers", () => {
    expect(classifyBankTransaction("Transfer between accounts", -5000)).toMatchObject({ proposedType: "transfer", confidence: 95 });
  });
});
