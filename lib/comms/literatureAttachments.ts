import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export async function loadLiteratureAttachments(supabase: SupabaseClient, ids: string[], businessId?: string): Promise<EmailAttachment[]> {
  const uniqueIds = [...new Set(ids)].slice(0, 10);
  if (!uniqueIds.length) return [];

  let query = supabase
    .from("literature_assets")
    .select("id, display_name, storage_bucket, storage_path, mime_type, file_size")
    .in("id", uniqueIds)
    .eq("is_active", true);
  if (businessId) query = query.eq("business_id", businessId);
  const { data, error } = await query;

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length !== uniqueIds.length) throw new Error("One or more selected literature files are unavailable.");

  const totalSize = rows.reduce((sum, row) => sum + Number(row.file_size || 0), 0);
  if (totalSize > 25 * 1024 * 1024) throw new Error("Selected literature exceeds the 25 MB email attachment limit.");

  const attachments: EmailAttachment[] = [];
  for (const row of rows) {
    const download = await supabase.storage.from(row.storage_bucket).download(row.storage_path);
    if (download.error || !download.data) throw new Error(`Could not attach ${row.display_name}.`);
    attachments.push({
      filename: row.display_name,
      content: Buffer.from(await download.data.arrayBuffer()).toString("base64"),
      contentType: row.mime_type || undefined
    });
  }
  return attachments;
}

export async function loadJobDocumentAttachments(
  supabase: SupabaseClient,
  ids: string[],
  jobId: string,
  businessId: string
): Promise<EmailAttachment[]> {
  const uniqueIds = [...new Set(ids)].slice(0, 20);
  if (!uniqueIds.length) return [];

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (jobError || !job) throw new Error("The draft job is unavailable in this workspace.");

  const { data, error } = await supabase
    .from("job_documents")
    .select("id, display_name, storage_bucket, storage_path, mime_type, file_size, content_html")
    .eq("job_id", jobId)
    .in("id", uniqueIds);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length !== uniqueIds.length) throw new Error("One or more selected job documents are unavailable on this job.");

  const attachments: EmailAttachment[] = [];
  for (const row of rows) {
    if (row.storage_bucket && row.storage_path) {
      const download = await supabase.storage.from(row.storage_bucket).download(row.storage_path);
      if (download.error || !download.data) throw new Error(`Could not attach ${row.display_name}.`);
      attachments.push({
        filename: row.display_name,
        content: Buffer.from(await download.data.arrayBuffer()).toString("base64"),
        contentType: row.mime_type || undefined
      });
      continue;
    }
    if (row.content_html) {
      attachments.push({
        filename: /\.html?$/i.test(row.display_name) ? row.display_name : `${row.display_name}.html`,
        content: Buffer.from(row.content_html, "utf8").toString("base64"),
        contentType: "text/html; charset=utf-8"
      });
      continue;
    }
    throw new Error(`${row.display_name} does not have a stored file to attach.`);
  }
  return attachments;
}

export function assertEmailAttachmentLimit(attachments: EmailAttachment[]) {
  const totalBytes = attachments.reduce((sum, attachment) => sum + Buffer.byteLength(attachment.content, "base64"), 0);
  if (totalBytes > 25 * 1024 * 1024) throw new Error("Selected attachments exceed the 25 MB email attachment limit.");
}
