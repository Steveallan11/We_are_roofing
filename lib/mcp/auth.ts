import { timingSafeEqual } from "node:crypto";
import { createClient, type User } from "@supabase/supabase-js";
import { requireClientEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type McpPrincipal = {
  userId: string;
  user?: User;
  authMethod: "static_bearer" | "supabase";
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() ?? "";
}

function matchesStaticBearer(token: string) {
  const expected = process.env.MCP_BEARER_TOKEN?.trim();
  if (!expected) return false;

  const suppliedBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function authenticateMcpRequest(request: Request): Promise<McpPrincipal | null> {
  const token = bearerToken(request);
  if (!token) return null;

  if (matchesStaticBearer(token)) {
    return {
      userId: "mcp-owner",
      authMethod: "static_bearer"
    };
  }

  const env = requireClientEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const allowedEmail = (process.env.MVP_ADMIN_EMAIL || process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL)?.trim().toLowerCase();
  if (!allowedEmail || data.user.email?.toLowerCase() !== allowedEmail) return null;

  return {
    userId: data.user.id,
    user: data.user,
    authMethod: "supabase"
  };
}

/**
 * Bind an authenticated MCP principal to exactly one configured workspace.
 * A caller can never choose a business id in tool input.
 */
export async function resolveMcpBusinessId(): Promise<string> {
  const configured = process.env.MCP_BUSINESS_ID?.trim();
  const supabase = createSupabaseAdminClient();
  if (configured) {
    const { data, error } = await supabase.from("businesses").select("id").eq("id", configured).maybeSingle();
    if (error || !data) throw new Error("MCP_BUSINESS_ID does not identify an available business.");
    return String(data.id);
  }

  const { data, error } = await supabase.from("businesses").select("id").order("created_at").limit(2);
  if (error) throw new Error("Unable to resolve the MCP workspace.");
  if ((data ?? []).length !== 1) {
    throw new Error("Set MCP_BUSINESS_ID when more than one business exists.");
  }
  return String(data![0].id);
}
