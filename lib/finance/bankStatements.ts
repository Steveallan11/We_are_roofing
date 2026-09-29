export type BankTransactionType = "expense" | "customer_payment" | "supplier_payment" | "transfer" | "refund" | "income" | "ignore" | "unmatched";

export const BANK_EXPENSE_CATEGORIES = [
  "Materials", "Scaffold", "Subcontractor", "Labour", "Plant Hire", "Waste", "Fuel", "Tools",
  "Insurance", "Office", "Advertising", "Professional Fees", "Vehicle", "Accommodation", "Other"
] as const;

export function normaliseBankDescription(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ");
}

export function classifyBankTransaction(descriptionInput: unknown, amountInput: unknown) {
  const description = normaliseBankDescription(descriptionInput);
  const amount = Number(amountInput);
  const moneyIn = amount > 0;
  if (/(TRANSFER BETWEEN|INTERNAL TRANSFER|TO SAVINGS|FROM SAVINGS)/.test(description)) {
    return { proposedType: "transfer" as BankTransactionType, category: null, confidence: 95, reasoning: "Looks like an internal account transfer; review before ignoring it." };
  }
  if (moneyIn) {
    return { proposedType: "customer_payment" as BankTransactionType, category: null, confidence: 45, reasoning: "Money received may be a customer payment, refund, finance receipt or other income; match it before approval." };
  }
  const rules: Array<[RegExp, string, number]> = [
    [/(JEWSON|TRAVIS PERKINS|BUILDBASE|SELCO|ROOFING SUPPL|SIG ROOF|AJW DISTRIBUTION)/, "Materials", 90],
    [/(SCAFFOLD)/, "Scaffold", 88],
    [/(SCREWFIX|TOOLSTATION)/, "Tools", 82],
    [/(SKIP|WASTE|GRAB HIRE|RECYCL)/, "Waste", 85],
    [/(SHELL|BP |ESSO|TEXACO|MOTOR FUEL|PETROL|DIESEL)/, "Fuel", 78],
    [/(PLANT HIRE|HSS HIRE|SUNBELT|BRANDON HIRE)/, "Plant Hire", 85],
    [/(INSURANCE|AVIVA|AXA|HISCOX|DIRECT LINE)/, "Insurance", 78],
    [/(GOOGLE ADS|FACEBOOK|META |YELL|ADVERT)/, "Advertising", 80],
    [/(ACCOUNTANT|SOLICITOR|LEGAL|PROFESSIONAL)/, "Professional Fees", 75],
    [/(HOTEL|TRAVELODGE|PREMIER INN|BOOKING COM)/, "Accommodation", 76],
    [/(WAGES|PAYROLL|SALARY)/, "Labour", 70]
  ];
  for (const [pattern, category, confidence] of rules) {
    if (pattern.test(description)) return { proposedType: "expense" as BankTransactionType, category, confidence, reasoning: `Description matched the ${category} rule. VAT and job still require review.` };
  }
  return { proposedType: "unmatched" as BankTransactionType, category: null, confidence: 10, reasoning: "No reliable category or ledger match was found." };
}

export function bankFingerprintSource(input: { accountKey?: unknown; date: unknown; amount: unknown; description: unknown; reference?: unknown }) {
  const amount = Number(input.amount);
  return [
    normaliseBankDescription(input.accountKey),
    String(input.date ?? "").slice(0, 10),
    Number.isFinite(amount) ? amount.toFixed(2) : "0.00",
    normaliseBankDescription(input.description),
    normaliseBankDescription(input.reference)
  ].join("|");
}
