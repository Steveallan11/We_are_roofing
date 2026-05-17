import { NextResponse } from "next/server";
import { getBusiness } from "@/lib/data";
import { parseKnowledgeUpload, createSourceRecordId } from "@/lib/knowledge-upload";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStoragePublicUrl, JOB_DOCUMENTS_BUCKET, ensurePublicStorageBucket } from "@/lib/storage";
import { canPersistToSupabase } from "@/lib/workflows";

export const runtime = "nodejs";
export const maxDuration = 60;

type UploadResult = {
  file_name: string;
  uploaded_url: string | null;
  parsed: number;
  inserted_historical_quotes: number;
  inserted_knowledge_entries: number;
  skipped_duplicates: number;
  warning?: string;
  error?: string;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "Upload at least one file." }, { status: 400 });
  }

  if (!canPersistToSupabase()) {
    return NextResponse.json({ ok: true, message: "Knowledge upload preview completed.", results: [] });
  }

  const business = await getBusiness();
  const supabase = createSupabaseAdminClient();
  const bucketResult = await ensurePublicStorageBucket(supabase, JOB_DOCUMENTS_BUCKET);
  if (!bucketResult.ok) {
    return NextResponse.json({ ok: false, error: bucketResult.error }, { status: 500 });
  }

  const results: UploadResult[] = [];

  for (const file of files) {
    const result: UploadResult = {
      file_name: file.name,
      uploaded_url: null,
      parsed: 0,
      inserted_historical_quotes: 0,
      inserted_knowledge_entries: 0,
      skipped_duplicates: 0
    };

    try {
      const storagePath = `knowledge/uploads/${Date.now()}-${safeFileName(file.name)}`;
      const upload = await supabase.storage.from(JOB_DOCUMENTS_BUCKET).upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || "application/octet-stream",
        upsert: true
      });

      if (upload.error) {
        result.error = upload.error.message;
        results.push(result);
        continue;
      }

      result.uploaded_url = getStoragePublicUrl(supabase, JOB_DOCUMENTS_BUCKET, storagePath);
      const parsed = await parseKnowledgeUpload(file);
      result.warning = parsed.warning;
      result.parsed = parsed.records.length;

      for (let index = 0; index < parsed.records.length; index += 1) {
        const record = parsed.records[index];
        const sourceRecordId = createSourceRecordId(file.name, record, index);
        if (record.recordType === "historical_quote") {
          const byRecordId = await supabase
            .from("historical_quotes")
            .select("id")
            .eq("business_id", business.id)
            .eq("source_record_id", sourceRecordId)
            .maybeSingle();
          const byReference = byRecordId.data
            ? byRecordId
            : await supabase
                .from("historical_quotes")
                .select("id")
                .eq("business_id", business.id)
                .eq("source_reference", record.sourceReference)
                .maybeSingle();

          if (byReference.data) {
            result.skipped_duplicates += 1;
            continue;
          }
        } else {
          const duplicate = await supabase.from("knowledge_base").select("id").eq("business_id", business.id).eq("title", record.title).maybeSingle();
          if (duplicate.data) {
            result.skipped_duplicates += 1;
            continue;
          }
        }

        if (record.recordType === "knowledge_base") {
          const insert = await supabase.from("knowledge_base").insert({
            business_id: business.id,
            title: record.title,
            category: record.category,
            content: record.content,
            source_type: "bulk_upload",
            tags: record.tags
          });
          if (insert.error) throw insert.error;
          result.inserted_knowledge_entries += 1;
          continue;
        }

        const insert = await supabase.from("historical_quotes").insert({
          business_id: business.id,
          title: record.title,
          source_reference: record.sourceReference,
          source_record_id: sourceRecordId,
          source_url: result.uploaded_url,
          source_type: "bulk_upload",
          source_date: record.sourceDate,
          source_year: record.sourceYear,
          roof_type: record.roofType,
          job_type: record.jobType,
          tags: record.tags,
          imported_text: record.content,
          scope_excerpt: record.scopeExcerpt,
          materials_excerpt: record.materialsExcerpt,
          original_total: record.originalTotal,
          uplifted_reference_total: null
        });

        if (insert.error) throw insert.error;
        result.inserted_historical_quotes += 1;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unable to process this file.";
    }

    results.push(result);
  }

  const insertedHistoricalQuotes = results.reduce((sum, result) => sum + result.inserted_historical_quotes, 0);
  const insertedKnowledgeEntries = results.reduce((sum, result) => sum + result.inserted_knowledge_entries, 0);
  const skippedDuplicates = results.reduce((sum, result) => sum + result.skipped_duplicates, 0);

  return NextResponse.json({
    ok: true,
    message: `Processed ${files.length} file${files.length === 1 ? "" : "s"}: ${insertedHistoricalQuotes} quote records, ${insertedKnowledgeEntries} knowledge entries, ${skippedDuplicates} duplicates skipped.`,
    results
  });
}
