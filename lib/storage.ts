import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const JOB_DOCUMENTS_BUCKET = "job-documents";
export const SURVEY_IMAGES_BUCKET = "survey-images";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export async function ensurePublicStorageBucket(supabase: AdminSupabaseClient, bucketName: string) {
  return ensureStorageBucket(supabase, bucketName, true);
}

export async function ensurePrivateStorageBucket(supabase: AdminSupabaseClient, bucketName: string) {
  return ensureStorageBucket(supabase, bucketName, false);
}

async function ensureStorageBucket(supabase: AdminSupabaseClient, bucketName: string, isPublic: boolean) {
  const bucketLookup = await supabase.storage.getBucket(bucketName);

  if (bucketLookup.error) {
    const createResult = await supabase.storage.createBucket(bucketName, {
      public: isPublic
    });

    if (createResult.error) {
      return {
        ok: false as const,
        error: createResult.error.message
      };
    }

    return {
      ok: true as const,
      created: true as const
    };
  }

  if (bucketLookup.data.public !== isPublic) {
    const updateResult = await supabase.storage.updateBucket(bucketName, {
      public: isPublic
    });

    if (updateResult.error) {
      return {
        ok: false as const,
        error: updateResult.error.message
      };
    }

    return {
      ok: true as const,
      updated: true as const
    };
  }

  return {
    ok: true as const
  };
}

export function getStoragePublicUrl(supabase: AdminSupabaseClient, bucketName: string, storagePath: string) {
  return supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl ?? null;
}
