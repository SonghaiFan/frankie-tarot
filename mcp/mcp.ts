import { createHash, randomUUID } from "node:crypto";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { localeSchema, SPREAD_IDS, spreadSchema, listSpreads, callCoreTool } from "./catalog";
import { flowSchema, viewResult } from "./flow";
import type { TarotView } from "./shared";

/** Content-addressed resources prevent hosts from reusing an older UI after deploy. */
export function getUiUri(html: string) {
  return `ui://frankie-tarot/app-${createHash("sha256").update(html).digest("hex").slice(0,20)}.html`;
}
export const VERSION = "0.5.1";
const noauth = { securitySchemes: [{ type: "noauth" }] };
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

export function createMcpServer(options: {
  widgetHtml: string;
  publicBaseUrl: string;
  uiDomain?: string;
  coreTool?: typeof callCoreTool;
}) {
  const uiUri = getUiUri(options.widgetHtml);
  const server = new McpServer({ name: "frankie-tarot", version: VERSION }, {
    instructions: "F.Tarot provides open_tarot, list_tarot_spreads, and get_tarot_reading_context. Spread listings and authoritative reading context come from the independent core Agent MCP. Reuse the latest flowId for the same interactive table and preserve the user's question verbatim. For an unspecified or smart/AUTO spread, call list_tarot_spreads, choose an actual spread based on the question and position goals, briefly explain the choice, then call open_tarot with question, spread, locale and current flowId. Honor an explicitly chosen spread. Opening only prepares the original app; the user starts, selects and flips cards in its UI. Never draw, flip, track reveal progress or request hidden cards. Clicking a card may attach only that card as context; this neither requests an interpretation nor starts a reply. Interpret a selected card only when the user asks. After all cards are revealed, the UI asks the adapter to validate the exact private snapshot through get_tarot_reading_context, then explicitly requests a short poetic summary. Write 2–4 restrained sentences grounded in that validated context, then call open_tarot with the supplied flowId, locale and summary={readingId,text}, without question or spread. This writes back to the existing reading without drawing. Do not repeat the summary in chat. Clicking Interpret requests the same validated context and then asks for a direct conversational interpretation. Follow-up questions reuse the same snapshot; never redraw. Save Result exports the current image without interpretation. With flowId and no question, open_tarot resumes the existing widget's private state when available; never claim recovery succeeded without UI confirmation. Tarot supports reflection, not factual prediction.",
  });

  server.registerTool("list_tarot_spreads", {
    title: "List F.Tarot spreads",
    description: "List the 11 supported tarot spreads with localized labels and card counts, without drawing cards. Use these descriptions and position labels for smart spread selection; AUTO is a UI choice, not a drawable spread.",
    inputSchema: z.object({ locale: localeSchema.default("zh-CN") }).strict(),
    outputSchema: z.object({ locale: localeSchema, spreads: z.array(spreadSchema) }),
    annotations: { ...annotations, idempotentHint: true }, _meta: noauth,
  }, async ({ locale }) => {
    const payload = {locale,spreads:await listSpreads(locale, options.coreTool ?? callCoreTool)};
    return { structuredContent: payload as unknown as Record<string, unknown>, content: [{ type: "text" as const,
      text: payload.spreads.map((spread) => `${spread.id}: ${spread.name} (${spread.cardCount})`).join("\n") }] };
  });

  const tableMeta = { ...noauth, ui: {resourceUri: uiUri, visibility: ["model", "app"] as ("model" | "app")[]} };
  const readingIdSchema = z.string().refine((value) => /^[a-f0-9]{24}$/.test(value) || z.string().uuid().safeParse(value).success,
    "Reading ID must be a current service ID or a legacy UUID.");
  const flowIdSchema = z.string().uuid().optional().describe('Reuse the flowId from the latest app context or tool result in this conversation, including for a new question. Omit only on the first launch. This updates the existing interaction window.');
  const guarded = async (action: () => TarotView | Promise<TarotView>) => {
    try {
      const result = viewResult(await action());
      return {...result, _meta:{...result._meta, ui:{resourceUri:uiUri}}};
    }
    catch (error) { return {isError:true, content:[{type:"text" as const,text:(error as Error).message}]}; }
  };
  registerAppTool(server, "open_tarot", {
    title: "Open F.Tarot",
    description: "Open the original app. For an unspecified spread, first list_tarot_spreads and intelligently choose a suitable spread. Pass the user's exact question and chosen spread to enter INPUT with that question already filled; no cards are drawn. Empty arguments open the welcome screen. Reuse the current flowId for a new question in the same conversation. With flowId and no question, resume the same widget using its private saved state. Starting and flipping remain in the UI. Never interpret concealed cards. For the app’s brief-summary request, use summary with the exact readingId and flowId to update the existing table; omit question and spread.",
    inputSchema: z.object({question:z.string().max(2000).optional(), spread:z.enum(SPREAD_IDS).optional(), locale:localeSchema.optional(),flowId:flowIdSchema,summary:z.object({readingId:readingIdSchema,text:z.string().trim().min(1).max(800)}).strict().optional()}).strict(),
    outputSchema: flowSchema, annotations:{...annotations,idempotentHint:true},
    _meta:tableMeta,
  }, async ({question,spread,locale = 'zh-CN',flowId,summary}) => guarded(async () => {
    if (summary && (!flowId || question !== undefined || spread !== undefined)) throw new Error('Summary requires the current flowId and no new question or spread.');
    return ({
    locale,spreads:await listSpreads(locale, options.coreTool ?? callCoreTool),flowId:flowId ?? randomUUID(),
    restoreRequested:!!flowId && question === undefined,
    summary,question,spread:spread ?? 'THREE',stage:question !== undefined ? 'input' : 'intro',
  });}));

  server.registerTool("get_tarot_reading_context", {
    title: "Get validated reading context",
    description: "Rebuild authoritative reading context from the independent F.Tarot API through its Agent MCP. The caller retains the reading snapshot; this tool does not redraw or persist it.",
    inputSchema: { reading: z.record(z.string(), z.unknown()), question: z.string().trim().max(2000).default(""), locale: localeSchema.default("zh-CN") },
    outputSchema: z.record(z.string(), z.unknown()),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (args) => {
    try {
      const payload = await (options.coreTool ?? callCoreTool)("get_tarot_reading_context", args);
      return { structuredContent: payload, content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Core MCP context lookup failed." }] };
    }
  });

  const readUi = (uri: string) => ({
    contents: [{
      uri, mimeType: RESOURCE_MIME_TYPE, text: options.widgetHtml,
      _meta: {
        ui: {
          prefersBorder: false,
          csp: {
            connectDomains: [...new Set([new URL(options.publicBaseUrl).origin, process.env.VITE_TAROT_API_URL ? new URL(process.env.VITE_TAROT_API_URL).origin : undefined].filter(Boolean))] as string[],
            resourceDomains: [...new Set([new URL(options.publicBaseUrl).origin, process.env.VITE_TAROT_API_URL ? new URL(process.env.VITE_TAROT_API_URL).origin : undefined, "https://fonts.googleapis.com", "https://fonts.gstatic.com"].filter(Boolean))] as string[],
          },
          ...(options.uiDomain ? { domain: options.uiDomain } : {}),
        },
        "openai/ui": { preferredDisplayMode: "inline", availableDisplayModes: ["inline", "fullscreen"] },
        "openai/widgetDescription": "The original bilingual tarot app. Users draw and flip in the UI, attach a selected card as context, and explicitly request conversational interpretation.",
      },
    }],
  });
  registerAppResource(server, "F.Tarot interaction", uiUri, {}, async () => readUi(uiUri));
  // Connected hosts can retain an earlier deployment's tool descriptor. Keep
  // those launch URLs readable as aliases to the current, compatible app.
  server.registerResource("F.Tarot previous launch", new ResourceTemplate(
    "ui://frankie-tarot/app-{hash}.html", { list: undefined },
  ), { mimeType: RESOURCE_MIME_TYPE }, async (uri, { hash }) => {
    if (typeof hash !== "string" || !/^[a-f0-9]{20}$/.test(hash)) throw new Error("Invalid F.Tarot UI resource.");
    return readUi(uri.href);
  });
  return server;
}
