import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { TarotEngine } from "./engine";
import { createMcpServer, VERSION } from "./mcp";
export { createMcpServer, VERSION, UI_URI } from "./mcp";
const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;
function send(res: ServerResponse, status: number, type: string, body: string | Buffer) {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
  res.end(body);
}

export function createTarotHttpServer(options: {
  engine: TarotEngine;
  widgetHtml: string;
  publicBaseUrl: string;
  assetDirectory: string;
  uiDomain?: string;
  preview?: { html: string; javascript: string };
}) {
  const publicUrl = new URL(options.publicBaseUrl);
  return createServer(async (req, res) => {
    const host = req.headers.host ?? "";
    if (host !== publicUrl.host && !localHost.test(host)) {
      return send(res, 403, "text/plain", "Unexpected Host header.");
    }
    const origin = req.headers.origin;
    if (origin && !(origin === "null" && req.method === "GET" && /^\/(audio|images)\//.test(req.url ?? "")) && origin !== publicUrl.origin && origin !== "https://chatgpt.com" &&
      !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin)) {
      return send(res, 403, "text/plain", "Unexpected Origin header.");
    }
    if (origin) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    let pathname: string;
    try { pathname = new URL(req.url ?? "/", publicUrl).pathname; }
    catch { return send(res, 400, "text/plain", "Invalid URL."); }
    try {
      if (pathname === "/health" && req.method === "GET") {
        return send(res, 200, "application/json", JSON.stringify({ status: "ok", name: "frankie-tarot", version: VERSION }));
      }
      const back = /^\/images\/card-backs\/([a-z-]+\.svg)$/.exec(pathname);
      if (back && req.method === "GET") {
        try { return send(res, 200, "image/svg+xml", await readFile(join(options.assetDirectory, "../card-backs", back[1]))); }
        catch { return send(res, 404, "text/plain", "Card back not found."); }
      }
      const imageRoute = /^\/images\/(cards|cards_dreamy|cards_rws_original)\/([a-zA-Z0-9_-]+\.webp)$/.exec(pathname);
      if (imageRoute && req.method === "GET") {
        const style = { cards: "redraw", cards_dreamy: "dreamy", cards_rws_original: "original" }[imageRoute[1]];
        try {
          const file = await readFile(join(options.assetDirectory, style!, imageRoute[2]));
          res.setHeader("Access-Control-Allow-Origin", "*");
          return send(res, 200, "image/webp", file);
        } catch { return send(res, 404, "text/plain", "Card image not found."); }
      }
      const audio = /^\/audio\/([a-zA-Z0-9_-]+\.mp3)$/.exec(pathname);
      if (audio && req.method === "GET") {
        try {
          const file = await readFile(join(options.assetDirectory, "../audio", audio[1]));
          res.setHeader("Access-Control-Allow-Origin", "*");
          return send(res, 200, "audio/mpeg", file);
        } catch { return send(res, 404, "text/plain", "Audio not found."); }
      }
      const asset = /^\/assets\/(redraw|original)\/([a-zA-Z0-9_-]+\.webp)$/.exec(pathname);
      if (asset && req.method === "GET") {
        let file: Buffer;
        try { file = await readFile(join(options.assetDirectory, asset[1], asset[2])); }
        catch { return send(res, 404, "text/plain", "Card image not found."); }
        res.setHeader("Cache-Control", "public, max-age=86400");
        return send(res, 200, "image/webp", file);
      }
      if (options.preview && req.method === "GET") {
        if (pathname === "/" || pathname === "/preview") return send(res, 200, "text/html; charset=utf-8", options.preview.html);
        if (pathname === "/preview.js") return send(res, 200, "application/javascript", options.preview.javascript);
      }
      if (pathname !== "/mcp") return send(res, 404, "text/plain", "Not found.");
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID");
        res.writeHead(204); res.end(); return;
      }
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST, OPTIONS");
        return send(res, 405, "application/json", JSON.stringify({ jsonrpc: "2.0", id: null,
          error: { code: -32000, message: "This stateless MCP server accepts POST requests." } }));
      }
      const server = createMcpServer(options);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 128 * 1024,
      });
      res.once("close", () => { void transport.close(); void server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) send(res, 500, "text/plain", "The tarot server could not complete this request.");
      else if (!res.writableEnded) res.end();
    }
  });
}
