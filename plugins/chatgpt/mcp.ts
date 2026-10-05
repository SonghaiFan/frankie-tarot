import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { OpenAIUiToolMetadata } from "@openai/mcp-extensions/server";
import { z } from "zod";
import { drawInputSchema, localeSchema, SPREAD_IDS, spreadSchema, type TarotEngine } from "./engine";
import { flowSchema, restoreView, viewResult } from "./flow";
import type { TarotView } from "./shared";
import { validateBriefReading } from './prompts';

/** Content-addressed resources prevent hosts from reusing an older UI after deploy. */
export function getUiUri(html: string) {
  return `ui://frankie-tarot/app-${createHash("sha256").update(html).digest("hex").slice(0,20)}.html`;
}
export const VERSION = "0.3.0";
const noauth = { securitySchemes: [{ type: "noauth" }] };
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

export function createMcpServer(options: {
  engine: TarotEngine;
  widgetHtml: string;
  publicBaseUrl: string;
  uiDomain?: string;
}) {
  const uiUri = getUiUri(options.widgetHtml);
  const resultUri = uiUri.replace("/app-", "/result-");
  const server = new McpServer({ name: "frankie-tarot", version: VERSION }, {
    instructions: "Frank Tarot shares one original app and a staged conversation. A question such as @Frank Tarot what should I consider this week must call open_tarot(question), not draw or interpret. The user chooses a spread and selects cards in the table. draw_tarot_cards is only for an explicit draw request. It opens PICKING and conceals all cards from the model. reveal_tarot_cards is only for an explicit user request to turn specified cards; otherwise wait for flips in the app. Never interpret before canInterpret=true AND the user requests interpretation. On that request follow interpretationPrompt (the website's shared voice and length: one cohesive paragraph, 120–180 Chinese characters or 130–180 English words). Call show_tarot_result with intent=interpret, the newest sessionToken and ONLY this brief initial interpretation. Then use the returned followUpPrompt (the website's copied Ask Deeper prompt) for deeper analysis in your ordinary chat response OUTSIDE the app; do not put that analysis in the card or replace the card. Subsequent deeper questions also belong in ordinary chat and preserve the brief card. For an explicit Save result request, call show_tarot_result with intent=save, preserving existing interpretation exactly, or omit interpretation if none exists. Saving is not permission to generate an interpretation or deeper analysis. Preserve cardFaceStyle from app context. Use the newest sessionToken from app context for all follow-ups; never invent cards, silently redraw, or reset progress. Hidden cards cannot be inferred. Tarot supports reflection, not factual prediction.",
  });

  server.registerTool("list_tarot_spreads", {
    title: "List F.Tarot spreads",
    description: "List the 11 supported tarot spreads with localized labels and card counts, without drawing cards. Choose a specific spread before draw_tarot_cards.",
    inputSchema: z.object({ locale: localeSchema.default("zh-CN") }).strict(),
    outputSchema: z.object({ locale: localeSchema, spreads: z.array(spreadSchema) }),
    annotations: { ...annotations, idempotentHint: true }, _meta: noauth,
  }, async ({ locale }) => {
    const payload = options.engine.setup(locale);
    return { structuredContent: payload as unknown as Record<string, unknown>, content: [{ type: "text" as const,
      text: payload.spreads.map((spread) => `${spread.id}: ${spread.name} (${spread.cardCount})`).join("\n") }] };
  });

  const tableMeta = { ...noauth, ui: {resourceUri: uiUri, visibility: ["model", "app"] as ("model" | "app")[]} };
  const tokenSchema = z.string().max(24_000);
  const guarded = async (action: () => TarotView) => {
    try { return viewResult(action()); }
    catch (error) { return {isError:true, content:[{type:"text" as const,text:(error as Error).message}]}; }
  };
  registerAppTool(server, "draw_tarot_cards", {
    title: "Select your tarot cards",
    description: "Start a NEW draw only when explicitly requested. Opens the original card selection stage. Cards stay hidden from the model until flipped. A general question should use open_tarot(question) first. Never redraw for follow-ups.",
    inputSchema: drawInputSchema, outputSchema: flowSchema,
    annotations: {...annotations, idempotentHint:false}, _meta: tableMeta,
  }, async input => guarded(() => {
    const drawn = options.engine.draw(input);
    return {...drawn, sessionToken: options.engine.sealSession({readingToken:drawn.readingToken!, revealed:[]}),
      stage:"picking", revealed:[], view:"table"};
  }));

  registerAppTool(server, "open_tarot", {
    title: "Open F.Tarot",
    description: "Open the original app. Pass the user's question and optional spread to enter INPUT with that question already filled; no cards are drawn. Empty arguments open the welcome screen. With sessionToken restore the same draw and its reveal progress. Never interpret concealed cards.",
    inputSchema: z.object({sessionToken:tokenSchema.optional(), readingToken:tokenSchema.optional(),
      question:z.string().max(2000).optional(), spread:z.enum(SPREAD_IDS).optional(), locale:localeSchema.optional()}).strict(),
    outputSchema: flowSchema, annotations:{...annotations,idempotentHint:true},
    _meta:{...tableMeta,"openai/ui":{entrypoints:[{type:"global"},{type:"thread"}]} satisfies OpenAIUiToolMetadata},
  }, async ({sessionToken,readingToken,question,spread,locale}) => guarded(() => {
    if (sessionToken) return restoreView(options.engine,sessionToken,locale);
    if (readingToken) {
      const restored = options.engine.restore(readingToken,locale);
      return {...restored,sessionToken:options.engine.sealSession({readingToken:restored.readingToken!,revealed:[]}),revealed:[],stage:"reveal",view:"table"};
    }
    return {...options.engine.setup(locale),question,spread:spread ?? "THREE",revealed:[],stage:question !== undefined ? "input" : "intro",view:"table"};
  }));

  registerAppTool(server, "reveal_tarot_cards", {
    title:"Reveal tarot cards",
    description:"Turn over specified 1-based positions in an EXISTING draw, only when the user explicitly requests a flip (or taps cards in the app). Preserve previously revealed cards. This updates the table. Do not call just to obtain hidden meanings. After all flips, wait for the user's interpretation request.",
    inputSchema:z.object({sessionToken:tokenSchema,positions:z.array(z.number().int().min(1).max(15)).min(1).max(15)}).strict(),
    outputSchema:flowSchema,annotations:{...annotations,idempotentHint:true},_meta:tableMeta,
  }, async ({sessionToken,positions}) => guarded(() => {
    const view = restoreView(options.engine,sessionToken);
    if (positions.some(p => p > view.reading!.cards.length)) throw new Error("Position outside this spread.");
    view.revealed = [...new Set([...view.revealed,...positions])].sort((a,b)=>a-b);
    view.sessionToken = options.engine.sealSession({readingToken:view.readingToken!,revealed:view.revealed});
    view.stage = view.revealed.length === view.reading!.cards.length ? "ready" : "reveal";
    return view;
  }));

  registerAppTool(server, "show_tarot_result", {
    title:"Your tarot reading",
    description:"Return the shared result card INLINE after ALL cards are revealed. For interpretation requests use intent=interpret and follow interpretationPrompt: one concise paragraph, 120–180 Chinese characters or 130–180 English words, the same voice as the website. Then use the returned followUpPrompt for deeper analysis in the ordinary chat response outside the app, never as card text. For Save result use intent=save and preserve existing interpretation exactly, or omit it if none exists; do not generate interpretation or deeper analysis. Preserve the existing draw and artwork. Fails while any card is hidden.",
    inputSchema:z.object({sessionToken:tokenSchema,interpretation:z.string().max(12000).optional(),cardFaceStyle:z.enum(["original","redraw","dreamy"]).optional(),intent:z.enum(['interpret','save']).default('save')}).strict(),
    outputSchema:flowSchema,annotations:{...annotations,idempotentHint:true},
    _meta:{...noauth,ui:{resourceUri:resultUri,visibility:["model","app"]}},
  }, async ({sessionToken,interpretation,cardFaceStyle,intent}) => guarded(() => {
    const view = restoreView(options.engine,sessionToken);
    if (view.revealed.length !== view.reading!.cards.length) throw new Error("Cards remain face down. Do not interpret yet. Wait for the user to reveal all cards.");
    if (intent === 'interpret') validateBriefReading(interpretation, view.locale);
    return {...view,stage:"result",view:"result",interpretation,cardFaceStyle,resultIntent:intent};
  }));

  for (const [uri, inline] of [[uiUri, false], [resultUri, true]] as const) registerAppResource(server, inline ? "F.Tarot reading card" : "F.Tarot card table", uri, {}, async () => ({
    contents: [{
      uri, mimeType: RESOURCE_MIME_TYPE, text: options.widgetHtml,
      _meta: {
        ui: {
          prefersBorder: false,
          csp: { connectDomains: [new URL(options.publicBaseUrl).origin], resourceDomains: [new URL(options.publicBaseUrl).origin, "https://fonts.googleapis.com", "https://fonts.gstatic.com"] },
          ...(options.uiDomain ? { domain: options.uiDomain } : {}),
        },
        "openai/ui": { preferredDisplayMode: "inline", availableDisplayModes: ["inline", "fullscreen"] },
        "openai/widgetDescription": "A bilingual tarot card table with server-drawn cards, deliberate reveal, reference meanings, and an explicit request for conversational interpretation.",
      },
    }],
  }));
  return server;
}
