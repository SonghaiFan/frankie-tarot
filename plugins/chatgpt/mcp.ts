import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { OpenAIUiToolMetadata } from "@openai/mcp-extensions/server";
import { z } from "zod";
import { drawInputSchema, localeSchema, payloadSchema, spreadSchema, type TarotEngine } from "./engine";
import type { TarotPayload } from "./shared";

/** Content-addressed resources prevent hosts from reusing an older UI after deploy. */
export function getUiUri(html: string) {
  return `ui://frankie-tarot/app-${createHash("sha256").update(html).digest("hex").slice(0,20)}.html`;
}
export const VERSION = "0.2.1";
const noauth = { securitySchemes: [{ type: "noauth" }] };
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

function result(payload: TarotPayload) {
  const reading = payload.reading;
  const text = reading
    ? [
      `F.Tarot reading ${reading.id}; ${reading.spread.name}.`,
      ...reading.cards.map((card) => `${card.position}. ${card.positionLabel}: ${card.name} (${card.isReversed ? "reversed" : "upright"}).`),
      "These exact cards are the authoritative draw. Preserve their identities, positions and orientations in follow-ups. Let the user inspect the cards first; provide interpretation when requested. Use the supplied meanings as reference for reflective exploration.",
    ].join("\n")
    : "F.Tarot is ready. The user can choose a spread, draw, and reveal the cards in the table. No cards have been drawn yet.";
  return { structuredContent: payload as unknown as Record<string, unknown>, content: [{ type: "text" as const, text }] };
}

export function createMcpServer(options: {
  engine: TarotEngine;
  widgetHtml: string;
  publicBaseUrl: string;
  uiDomain?: string;
  assetBaseUrl?: string;
}) {
  const uiUri = getUiUri(options.widgetHtml);
  const server = new McpServer({ name: "frankie-tarot", version: VERSION }, {
    instructions: "F.Tarot is an interactive bilingual tarot deck for reflection. Use list_tarot_spreads to inspect real spreads. Use draw_tarot_cards only for an explicit new draw, then open_tarot with the returned readingToken to show the same cards. Calling open_tarot with no token opens an empty table. Never invent card results or silently redraw on a follow-up. Interpret the existing cards in context when the user requests interpretation. Tarot is symbolic reflection; do not present it as a factual prediction or a substitute for the user's judgment.",
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

  server.registerTool("draw_tarot_cards", {
    title: "Draw F.Tarot cards",
    description: "Randomly draw a new tarot spread using the canonical deck. Only call when the user asks for a new draw. Returns exact card IDs, positions, orientations, meanings and a signed readingToken. Show it with open_tarot(readingToken); never redraw merely to render or answer a follow-up. No model API is called and no reading history is stored.",
    inputSchema: drawInputSchema, outputSchema: payloadSchema,
    annotations: { ...annotations, idempotentHint: false },
    _meta: { ...noauth, "openai/toolInvocation/invoking": "Drawing your cards…", "openai/toolInvocation/invoked": "Cards drawn" },
  }, async (input) => result(options.engine.draw(input)));

  registerAppTool(server, "open_tarot", {
    title: "Open F.Tarot",
    description: "Open the interactive F.Tarot table. Pass the exact readingToken from draw_tarot_cards to display an existing draw; accepts empty arguments to open the table from the sidebar. This tool never draws cards. Optional locale changes the display language while retaining the same cards.",
    inputSchema: z.object({ readingToken: z.string().max(24_000).optional(), locale: localeSchema.optional() }).strict(),
    outputSchema: payloadSchema,
    annotations: { ...annotations, idempotentHint: true },
    _meta: {
      ...noauth,
      ui: { resourceUri: uiUri, visibility: ["model", "app"] },
      "openai/ui": { entrypoints: [{ type: "global" }, { type: "thread" }] } satisfies OpenAIUiToolMetadata,
      "openai/toolInvocation/invoking": "Opening your table…",
      "openai/toolInvocation/invoked": "F.Tarot is open",
    },
  }, async ({ readingToken, locale }) => {
    try { return result(readingToken ? options.engine.restore(readingToken, locale) : options.engine.setup(locale)); }
    catch (error) { return { isError: true, content: [{ type: "text" as const, text: (error as Error).message }] }; }
  });

  registerAppResource(server, "F.Tarot card table", uiUri, {}, async () => ({
    contents: [{
      uri: uiUri, mimeType: RESOURCE_MIME_TYPE, text: options.widgetHtml,
      _meta: {
        ui: {
          prefersBorder: false,
          csp: { connectDomains: [new URL(options.assetBaseUrl || options.publicBaseUrl).origin], resourceDomains: [new URL(options.assetBaseUrl || options.publicBaseUrl).origin, "https://fonts.googleapis.com", "https://fonts.gstatic.com"] },
          ...(options.uiDomain ? { domain: options.uiDomain } : {}),
        },
        "openai/ui": { preferredDisplayMode: "fullscreen", availableDisplayModes: ["fullscreen"] },
        "openai/widgetDescription": "A bilingual tarot card table with server-drawn cards, deliberate reveal, reference meanings, and an explicit request for conversational interpretation.",
      },
    }],
  }));
  return server;
}

