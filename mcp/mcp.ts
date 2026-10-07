import { createHash, randomUUID } from "node:crypto";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { localeSchema, SPREAD_IDS, spreadSchema, listSpreads } from "./catalog";
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
}) {
  const uiUri = getUiUri(options.widgetHtml);
  const server = new McpServer({ name: "frankie-tarot", version: VERSION }, {
    instructions: "F.Tarot has two tools: open_tarot and list_tarot_spreads. Reuse the latest flowId for the same interactive table. Preserve the user's question verbatim. For an unspecified or smart/AUTO spread, call list_tarot_spreads, choose an actual spread based on the question, descriptions and positions, briefly explain the choice, then call open_tarot with question, spread, locale and the current flowId. Honor an explicitly chosen spread. Opening only prepares the original app; the user starts, selects and flips cards in its UI. Never draw, flip, track reveal progress or request hidden cards. Clicking a card may attach only that card as context; context updates do not request an interpretation or start a reply. Interpret a selected card only when the user asks. After all cards are revealed, the app explicitly requests a short poetic summary. Write 2–4 restrained sentences grounded in the submitted cards, then call open_tarot with the supplied flowId, locale and summary={readingId,text}, without question or spread. This writes back to the existing reading without drawing. Do not repeat the summary in chat. Clicking Interpret sends the complete revealed spread as an explicit user request; answer directly in ordinary chat without calling a result tool or reopening the app. Follow-up questions use the same reading. Save Result exports the current image without interpretation or redraw. With flowId and no question, open_tarot resumes the existing widget's private state when available; never claim recovery succeeded without UI confirmation. Tarot supports reflection, not factual prediction.",
  });

  server.registerTool("list_tarot_spreads", {
    title: "List F.Tarot spreads",
    description: "List the 11 supported tarot spreads with localized labels and card counts, without drawing cards. Use these descriptions and position labels for smart spread selection; AUTO is a UI choice, not a drawable spread.",
    inputSchema: z.object({ locale: localeSchema.default("zh-CN") }).strict(),
    outputSchema: z.object({ locale: localeSchema, spreads: z.array(spreadSchema) }),
    annotations: { ...annotations, idempotentHint: true }, _meta: noauth,
  }, async ({ locale }) => {
    const payload = {locale,spreads:listSpreads(locale)};
    return { structuredContent: payload as unknown as Record<string, unknown>, content: [{ type: "text" as const,
      text: payload.spreads.map((spread) => `${spread.id}: ${spread.name} (${spread.cardCount})`).join("\n") }] };
  });

  const tableMeta = { ...noauth, ui: {resourceUri: uiUri, visibility: ["model", "app"] as ("model" | "app")[]} };
  const flowIdSchema = z.string().uuid().optional().describe('Reuse the flowId from the latest app context or tool result in this conversation, including for a new question. Omit only on the first launch. This updates the existing interaction window.');
  const guarded = async (action: () => TarotView) => {
    try {
      const result = viewResult(action());
      return {...result, _meta:{...result._meta, ui:{resourceUri:uiUri}}};
    }
    catch (error) { return {isError:true, content:[{type:"text" as const,text:(error as Error).message}]}; }
  };
  registerAppTool(server, "open_tarot", {
    title: "Open F.Tarot",
    description: "Open the original app. For an unspecified spread, first list_tarot_spreads and intelligently choose a suitable spread. Pass the user's exact question and chosen spread to enter INPUT with that question already filled; no cards are drawn. Empty arguments open the welcome screen. Reuse the current flowId for a new question in the same conversation. With flowId and no question, resume the same widget using its private saved state. Starting and flipping remain in the UI. Never interpret concealed cards. For the app’s brief-summary request, use summary with the exact readingId and flowId to update the existing table; omit question and spread.",
    inputSchema: z.object({question:z.string().max(2000).optional(), spread:z.enum(SPREAD_IDS).optional(), locale:localeSchema.optional(),flowId:flowIdSchema,summary:z.object({readingId:z.string().uuid(),text:z.string().trim().min(1).max(800)}).strict().optional()}).strict(),
    outputSchema: flowSchema, annotations:{...annotations,idempotentHint:true},
    _meta:tableMeta,
  }, async ({question,spread,locale = 'zh-CN',flowId,summary}) => guarded(() => {
    if (summary && (!flowId || question !== undefined || spread !== undefined)) throw new Error('Summary requires the current flowId and no new question or spread.');
    return ({
    locale,spreads:listSpreads(locale),flowId:flowId ?? randomUUID(),
    restoreRequested:!!flowId && question === undefined,
    summary,question,spread:spread ?? 'THREE',stage:question !== undefined ? 'input' : 'intro',
  });}));

  const readUi = (uri: string) => ({
    contents: [{
      uri, mimeType: RESOURCE_MIME_TYPE, text: options.widgetHtml,
      _meta: {
        ui: {
          prefersBorder: false,
          csp: { connectDomains: [new URL(options.publicBaseUrl).origin], resourceDomains: [new URL(options.publicBaseUrl).origin, "https://fonts.googleapis.com", "https://fonts.gstatic.com"] },
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
