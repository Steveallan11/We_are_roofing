import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequest, resolveMcpBusinessId } from "@/lib/mcp/auth";
import { createRoofingMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MCP_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const MCP_RESOURCE_METADATA_URL =
  "https://we-are-roofing-roofiq.vercel.app/.well-known/oauth-protected-resource";

const MCP_AUTH_CHALLENGE =
  `Bearer resource_metadata="${MCP_RESOURCE_METADATA_URL}", scope="openid email profile"`;

function unauthorised() {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32001, message: "A valid We Are Roofing access token is required." },
      id: null
    },
    {
      status: 401,
      headers: {
        ...MCP_HEADERS,
        "WWW-Authenticate": MCP_AUTH_CHALLENGE
      }
    }
  );
}

export async function POST(request: Request) {
  const principal = await authenticateMcpRequest(request);
  if (!principal) return unauthorised();

  let businessId: string;
  try {
    businessId = await resolveMcpBusinessId();
  } catch (error) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: error instanceof Error ? error.message : "Workspace configuration error." }, id: null },
      { status: 500, headers: MCP_HEADERS }
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createRoofingMcpServer({ userId: principal.userId, businessId });
  await server.connect(transport);

  const response = await transport.handleRequest(request);
  const headers = new Headers(response.headers);
  Object.entries(MCP_HEADERS).forEach(([name, value]) => headers.set(name, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function GET() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405, headers: { ...MCP_HEADERS, Allow: "POST" } }
  );
}

export async function DELETE() {
  return GET();
}
