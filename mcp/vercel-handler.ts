import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp";

const widgetHtml = readFile(join(process.cwd(), "mcp/dist/widget.html"), "utf8");
const allowedHeaders = "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID";

function responseHeaders(origin?: string) {
  const headers = new Headers({
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": allowedHeaders,
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return headers;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("origin") ?? undefined;
  const headers = responseHeaders(origin);
  const trustedOrigins = new Set([url.origin, "https://chatgpt.com"]);

  if (origin && !trustedOrigins.has(origin)) {
    return new Response("Unexpected Origin header.", { status: 403, headers });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") {
    headers.set("Allow", "POST, OPTIONS");
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify({
      jsonrpc: "2.0", id: null, error: { code: -32000, message: "This stateless MCP server accepts POST requests." },
    }), { status: 405, headers });
  }

  let server: ReturnType<typeof createMcpServer> | undefined;
  let transport: WebStandardStreamableHTTPServerTransport | undefined;
  try {
    const baseUrl = url.origin;
    server = createMcpServer({
      widgetHtml: await widgetHtml,
      publicBaseUrl: baseUrl,
    });
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 128 * 1024,
    });
    await server.connect(transport);
    const result = await transport.handleRequest(request);
    const mergedHeaders = new Headers(result.headers);
    for (const [key, value] of headers) mergedHeaders.set(key, value);
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers: mergedHeaders });
  } catch {
    return new Response("The tarot server could not complete this request.", { status: 500, headers });
  } finally {
    await transport?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
  }
}
