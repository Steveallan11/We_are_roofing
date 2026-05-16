import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_MVP_ADMIN_EMAIL: z.string().email().optional()
});

const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  NOTION_API_KEY: z.string().min(1).optional(),
  NOTION_QUOTES_DATA_SOURCE_ID: z.string().min(1).optional(),
  NOTION_KNOWLEDGE_DATA_SOURCE_ID: z.string().min(1).optional(),
  NOTION_VERSION: z.string().min(1).default("2025-09-03"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  MVP_ADMIN_EMAIL: z.string().email().optional()
});

export const clientEnv = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_MVP_ADMIN_EMAIL: process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL
});

export const serverEnv = serverSchema.safeParse(process.env);

export function requireClientEnv() {
  if (!clientEnv.success) {
    throw new Error(`Missing client env: ${clientEnv.error.message}`);
  }
  return clientEnv.data;
}

export function requireServerEnv() {
  if (!serverEnv.success) {
    throw new Error(`Missing server env: ${serverEnv.error.message}`);
  }
  return serverEnv.data;
}
