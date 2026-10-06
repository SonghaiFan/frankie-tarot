import { createHash, randomUUID } from "node:crypto";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
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
  const server = new McpServer({ name: "frankie-tarot", version: VERSION }, {
    instructions: "F.Tarot uses ONE original interactive table per conversation. Reuse the latest flowId for open_tarot and draw_tarot_cards, including new questions. The user asks in their own words: preserve that question verbatim. For a question without a specified spread, use smart selection: call list_tarot_spreads, choose a suitable real spread based on its description and positions, briefly explain the choice, then call open_tarot with question, spread and locale. Do not ask the user to repeat their question or choose a spread unless they want to choose themselves. Honor any explicitly requested spread. Suggest the side tab / expanded view for more room, without claiming the host switched modes. Wait for the user to shuffle and manually pick cards in the app; a general question never authorizes drawing or flipping for them. draw_tarot_cards is only for an explicit draw action. After selection, explain revealOrder using position labels, never hidden card identities. On a turn with new revealed cards, briefly interpret only those cards using the user's question, position, orientation and meaning, unless the user asked to wait. Use conversation history to avoid repeating already discussed cards. Then name nextReveal and wait for the user to flip it; never call reveal_tarot_cards just to obtain meanings. App state updates do not automatically start a model turn. Never send fabricated user messages on selection or reveal. All card identities remain hidden until revealed. canInterpretRevealed permits discussing visible cards; canInterpret gates the full spread prompt. Clicking 深入解读 / Explore deeper sends interpretationPrompt verbatim and is an explicit full-reading request: answer it directly in ordinary chat, preserving the current draw. Do not call show_tarot_result or automatically send a second follow-up. show_tarot_result is optional only when the user explicitly asks to put a brief reading into the table. Save Result exports PNG through the existing app button and never generates interpretation. Use the newest sessionToken and cardFaceStyle from app context. Never silently redraw, reset progress, infer concealed cards, or open a second table for follow-ups. Tarot supports reflection, not factual prediction.",
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
  const flowIdSchema = z.string().uuid().optional().describe('Reuse the flowId from the latest app context or tool result in this conversation, including for a new question. Omit only on the first launch. This updates the existing interaction window.');
  const tokenSchema = z.string().max(24_000);
  const guarded = async (action: () => TarotView) => {
    try {
      const result = viewResult(action());
      return {...result, _meta:{...result._meta, ui:{resourceUri:uiUri}}};
    }
    catch (error) { return {isError:true, content:[{type:"text" as const,text:(error as Error).message}]}; }
  };
  registerAppTool(server, "draw_tarot_cards", {
    title: "Select your tarot cards",
    description: "Start a NEW draw only when explicitly requested. Pass the current flowId to update the existing window to the original card selection stage. Cards stay hidden from the model until flipped. A general question should use open_tarot(question) first. Never redraw for follow-ups.",
    inputSchema: drawInputSchema.extend({flowId:flowIdSchema}), outputSchema: flowSchema,
    annotations: {...annotations, idempotentHint:false}, _meta: tableMeta,
  }, async ({flowId = randomUUID(), ...input}) => guarded(() => {
    const drawn = options.engine.draw(input);
    return {...drawn, flowId, sessionToken: options.engine.sealSession({readingToken:drawn.readingToken!, revealed:[], flowId}),
      stage:"picking", revealed:[], view:"table"};
  }));

  registerAppTool(server, "open_tarot", {
    title: "Open F.Tarot",
    description: "Open the original app. For an unspecified spread, first list_tarot_spreads and intelligently choose a suitable spread. Pass the user's exact question and chosen spread to enter INPUT with that question already filled; no cards are drawn. Empty arguments open the welcome screen. Reuse the current flowId for a new question in the same conversation. With sessionToken restore the same draw and its reveal progress in the same window. Never interpret concealed cards.",
    inputSchema: z.object({sessionToken:tokenSchema.optional(), readingToken:tokenSchema.optional(),
      question:z.string().max(2000).optional(), spread:z.enum(SPREAD_IDS).optional(), locale:localeSchema.optional(),flowId:flowIdSchema}).strict(),
    outputSchema: flowSchema, annotations:{...annotations,idempotentHint:true},
    _meta:{...tableMeta,"openai/ui":{entrypoints:[{type:"global"},{type:"thread"}]} satisfies OpenAIUiToolMetadata},
  }, async ({sessionToken,readingToken,question,spread,locale,flowId = randomUUID()}) => guarded(() => {
    if (sessionToken) return restoreView(options.engine,sessionToken,locale);
    if (readingToken) {
      const restored = options.engine.restore(readingToken,locale);
      return {...restored,flowId,sessionToken:options.engine.sealSession({readingToken:restored.readingToken!,revealed:[],flowId}),revealed:[],stage:"reveal",view:"table"};
    }
    return {...options.engine.setup(locale),flowId,question,spread:spread ?? "THREE",revealed:[],stage:question !== undefined ? "input" : "intro",view:"table"};
  }));

  registerAppTool(server, "reveal_tarot_cards", {
    title:"Reveal tarot cards",
    description:"Turn over specified 1-based positions in an EXISTING draw, only when the user explicitly requests a flip (or taps cards in the app). Preserve previously revealed cards. This updates the table. Do not call just to obtain hidden meanings. Interpret newlyRevealed cards on the current assistant turn unless the user asked to wait, then guide nextReveal. Full-spread analysis waits for an explicit request.",
    inputSchema:z.object({sessionToken:tokenSchema,positions:z.array(z.number().int().min(1).max(15)).min(1).max(15)}).strict(),
    outputSchema:flowSchema,annotations:{...annotations,idempotentHint:true},_meta:tableMeta,
  }, async ({sessionToken,positions}) => guarded(() => {
    const view = restoreView(options.engine,sessionToken);
    if (positions.some(p => p > view.reading!.cards.length)) throw new Error("Position outside this spread.");
    view.newlyRevealed = [...new Set(positions)].filter(p => !view.revealed.includes(p)).sort((a,b)=>a-b);
    view.revealed = [...new Set([...view.revealed,...positions])].sort((a,b)=>a-b);
    view.sessionToken = options.engine.sealSession({readingToken:view.readingToken!,revealed:view.revealed,flowId:view.flowId});
    view.stage = view.revealed.length === view.reading!.cards.length ? "ready" : "reveal";
    return view;
  }));

  registerAppTool(server, "show_tarot_result", {
    title:"Your tarot reading",
    description:"Only when the user explicitly asks to place a brief interpretation in the existing table, write one concise paragraph (at most 180 Chinese characters or English words) with intent=interpret. Ordinary interpretation and Explore deeper requests should be answered directly in chat without this tool. Requires all cards revealed. Preserve the same draw, flowId and artwork. Legacy intent=save preserves supplied text; this tool does not export PNG. Use the app Save Result button for image export.",
    inputSchema:z.object({sessionToken:tokenSchema,interpretation:z.string().max(12000).optional(),cardFaceStyle:z.enum(["original","redraw","dreamy"]).optional(),intent:z.enum(['interpret','save']).default('save')}).strict(),
    outputSchema:flowSchema,annotations:{...annotations,idempotentHint:true},
    _meta:tableMeta,
  }, async ({sessionToken,interpretation,cardFaceStyle,intent}) => guarded(() => {
    const view = restoreView(options.engine,sessionToken);
    if (view.revealed.length !== view.reading!.cards.length) throw new Error("Cards remain face down. Do not interpret yet. Wait for the user to reveal all cards.");
    if (intent === 'interpret') validateBriefReading(interpretation, view.locale);
    return {...view,stage:"result",view:"table",interpretation,cardFaceStyle,resultIntent:intent};
  }));

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
        "openai/widgetDescription": "A bilingual tarot card table with server-drawn cards, deliberate reveal, reference meanings, and an explicit request for conversational interpretation.",
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
