import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer, VERSION } from "./mcp";
import { createTarotEngine } from "./engine";
import assetSource from "./asset-source.json";
import widgetHtml from "./dist/widget.html";
interface Env {
  TAROT_SIGNING_KEY: string;
  PUBLIC_BASE_URL: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({status:"ok",name:"frankie-tarot",version:VERSION});
    if (url.pathname !== "/mcp") {
      const asset = env.ASSETS ? await env.ASSETS.fetch(request) : new Response("Not found",{status:404});
      if (/^\/(images|audio|assets)\//.test(url.pathname)) {
        const headers = new Headers(asset.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        return new Response(asset.body, {status:asset.status,headers});
      }
      return asset;
    }
    if (request.method !== "POST") return new Response("Use POST",{status:405,headers:{Allow:"POST"}});
    if (!env.TAROT_SIGNING_KEY || env.TAROT_SIGNING_KEY.length < 32) return new Response("Signing key is not configured",{status:503});
    const publicBaseUrl = env.PUBLIC_BASE_URL || url.origin;
    const server=createMcpServer({engine:createTarotEngine({publicBaseUrl,assetBaseUrl:assetSource.baseUrl,signingKey:env.TAROT_SIGNING_KEY}),widgetHtml,publicBaseUrl,assetBaseUrl:assetSource.baseUrl});
    const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxRequestBodySize:128*1024});
    try {
      await server.connect(transport);
      const response=await transport.handleRequest(request);
      const body=await response.arrayBuffer();
      return new Response(body.byteLength ? body : null,{status:response.status,headers:response.headers});
    } finally { await server.close(); }
  },
};
