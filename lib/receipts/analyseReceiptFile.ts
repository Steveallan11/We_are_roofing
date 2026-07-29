import type { JobExpenseCategory } from "@/lib/types";

export type ReceiptAnalysis = {
  supplier_name: string | null;
  description: string;
  category: JobExpenseCategory;
  amount_total: number | null;
  vat_amount: number | null;
  receipt_date: string | null;
  invoice_number: string | null;
  confidence: "high" | "medium" | "low";
  review_notes: string[];
};

export async function analyseReceiptFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/receipts/analyze", {
    method: "POST",
    body: formData
  });
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    analysis?: ReceiptAnalysis;
    error?: string;
  } | null;

  if (!response.ok || !result?.ok || !result.analysis) {
    throw new Error(result?.error || "AI could not read this receipt.");
  }

  return result.analysis;
}
