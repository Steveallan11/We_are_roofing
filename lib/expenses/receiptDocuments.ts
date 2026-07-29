import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobDocumentRecord, JobExpense } from "@/lib/types";

type ExpenseDocumentLink = {
  expense_id: string;
  document_id: string;
};

export async function attachReceiptDocuments(supabase: SupabaseClient, expenses: JobExpense[]) {
  const editableExpenseIds = expenses.filter((expense) => expense.source !== "diary").map((expense) => expense.id);
  if (editableExpenseIds.length === 0) return expenses;

  const { data: links, error: linkError } = await supabase
    .from("job_expense_documents")
    .select("expense_id, document_id")
    .in("expense_id", editableExpenseIds);

  if (linkError || !links?.length) return expenses;

  const typedLinks = links as ExpenseDocumentLink[];
  const documentIds = [...new Set(typedLinks.map((link) => link.document_id))];
  const { data: documents, error: documentError } = await supabase
    .from("job_documents")
    .select("*")
    .in("id", documentIds)
    .order("created_at", { ascending: false });

  if (documentError || !documents?.length) return expenses;

  const documentById = new Map((documents as JobDocumentRecord[]).map((document) => [document.id, document]));
  const documentsByExpense = new Map<string, JobDocumentRecord[]>();

  for (const link of typedLinks) {
    const document = documentById.get(link.document_id);
    if (!document) continue;
    const current = documentsByExpense.get(link.expense_id) ?? [];
    current.push(document);
    documentsByExpense.set(link.expense_id, current);
  }

  return expenses.map((expense) => ({
    ...expense,
    receipt_documents: documentsByExpense.get(expense.id) ?? expense.receipt_documents ?? []
  }));
}
