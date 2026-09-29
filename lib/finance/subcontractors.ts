import { decimalMultiply, fromPence } from "@/lib/finance/money";

export function calculateSubcontractorAmounts(input: {
  quantity: number | string;
  unitRate: number | string;
  vatRate: 0 | 5 | 20;
  cisRate: 0 | 20 | 30;
}) {
  const netPence = decimalMultiply(input.quantity, input.unitRate);
  const vatPence = Math.round(netPence * input.vatRate / 100);
  const cisPence = Math.round(netPence * input.cisRate / 100);
  const grossPence = netPence + vatPence;
  return {
    net: fromPence(netPence),
    vat: fromPence(vatPence),
    gross: fromPence(grossPence),
    cisDeduction: fromPence(cisPence),
    payable: fromPence(Math.max(0, grossPence - cisPence))
  };
}
