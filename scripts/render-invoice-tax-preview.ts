import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildInvoicePdfBuffer } from "../lib/invoice-engine";
import { getMockBundle } from "../lib/mock-data";
import type { InvoiceRecord } from "../lib/types";

async function main() {
  const bundle = getMockBundle("job-3");
  const source = bundle?.invoices[0];
  if (!bundle || !source) throw new Error("Mock invoice job-3 is unavailable.");

  const invoice: InvoiceRecord = {
    ...source,
    vat_treatment: "domestic_reverse_charge",
    vat_amount: 0,
    reverse_charge_vat_amount: 580,
    customer_vat_number: "GB123456789",
    cis_deduction_rate: 20,
    cis_labour_amount: 1900,
    cis_deduction_amount: 380,
    total: 2900,
    balance_due: 2520
  };
  const outputDir = path.resolve("output/pdf");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "invoice-reverse-charge-cis-preview.pdf");
  await writeFile(outputPath, buildInvoicePdfBuffer(bundle, invoice));
  console.log(outputPath);
}

void main();
