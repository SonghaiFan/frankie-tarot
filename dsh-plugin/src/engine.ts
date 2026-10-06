/**
 * Tarot engine for the DSH plugin host half.
 * Reuses main's platform-neutral engine (mcp/engine.ts): secure draws over the
 * canonical ground-truth.json, localized position-labelled readings, and signed
 * readingTokens for stable replay. No React, Vite or UI imports; Node only.
 */

export {
  createTarotEngine,
  drawInputSchema,
  getPoolIds,
  listSpreads,
  localeSchema,
  readingSchema,
  spreadSchema,
  SPREAD_IDS,
} from "../../mcp/engine";
export type { TarotEngine } from "../../mcp/engine";
export type { Locale, TarotPayload, TarotReading, TarotSpread } from "../../mcp/shared";
