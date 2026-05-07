import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSession() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}
