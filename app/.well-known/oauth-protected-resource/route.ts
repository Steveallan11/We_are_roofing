const MCP_RESOURCE = "https://we-are-roofing-roofiq.vercel.app/mcp";
const SUPABASE_AUTH_ISSUER = "https://mkttjtltxownxsfqhucr.supabase.co/auth/v1";

export function GET() {
  return Response.json(
    {
      resource: MCP_RESOURCE,
      authorization_servers: [SUPABASE_AUTH_ISSUER],
      scopes_supported: ["openid", "email", "profile"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://we-are-roofing-roofiq.vercel.app/docs/mcp"
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
