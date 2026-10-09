import type { TarotCard, TarotSuit } from "@/features/tarot/types";
import { registerRemoteCards } from "@/features/tarot/constants/cards";
import { registerRemoteSpreads, type ApiSpread } from "@/features/tarot/constants/spreads";
import { DEFAULT_TAROT_API_URL } from "./defaults";

export type ApiLocale = "en" | "zh-CN";

export const TAROT_API_BASE = (import.meta.env.VITE_TAROT_API_URL || DEFAULT_TAROT_API_URL).replace(/\/$/, "");
const apiCardIndices = new Map<string, number>();

export interface ApiCard {
  id: string;
  suit: TarotSuit | null;
  rank: number;
  names: { en: string; "zh-CN": string };
  imageUrls: { redraw: string; dreamy: string; original: string };
  keywords: { en: string[]; "zh-CN": string[] };
  description: { en: string; "zh-CN": string };
  meanings: { upright: { en: string; "zh-CN": string }; reversed: { en: string; "zh-CN": string } };
}

export function toTarotCard(card: ApiCard, deckIndex?: number): TarotCard {
  const id = deckIndex ?? apiCardIndices.get(card.id);
  if (id === undefined) throw new Error(`Card ${card.id} is missing from the loaded API deck.`);
  return {
    id,
    nameEn: card.names.en,
    nameCn: card.names["zh-CN"],
    descriptionEn: card.description.en,
    descriptionCn: card.description["zh-CN"],
    keywordsEn: card.keywords.en,
    keywords: card.keywords["zh-CN"],
    image: card.id,
    suit: card.suit,
    rank: card.rank,
    imageUrls: card.imageUrls,
    positiveEn: card.meanings.upright.en,
    positive: card.meanings.upright["zh-CN"],
    negativeEn: card.meanings.reversed.en,
    negative: card.meanings.reversed["zh-CN"],
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TAROT_API_BASE}${path}`, init);
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Tarot API returned a non-JSON response (${response.status}).`);
  }
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Tarot API returned ${response.status}.`);
  return payload as T;
}

/** Catalog-only client. Selection, orientation and retry/recovery state belong to the local table. */
export async function loadApiDeck(locale: ApiLocale) {
  const { cards } = await apiRequest<{ cards: ApiCard[] }>(`/api/v1/cards?locale=${encodeURIComponent(locale)}`);
  if (!Array.isArray(cards) || !cards.length || new Set(cards.map((card) => card.id)).size !== cards.length) {
    throw new Error("The API returned an incomplete or invalid card catalog.");
  }
  apiCardIndices.clear();
  cards.forEach((card, index) => apiCardIndices.set(card.id, index));
  const mappedCards = cards.map((card, index) => toTarotCard(card, index));
  registerRemoteCards(mappedCards);
  return { cards: mappedCards };
}

export async function loadApiSpreads(locale: ApiLocale) {
  const response = await apiRequest<{ spreads: ApiSpread[]; locale: ApiLocale }>(`/api/v1/spreads?locale=${encodeURIComponent(locale)}`);
  if (!response.spreads.length || new Set(response.spreads.map((spread) => spread.id)).size !== response.spreads.length) {
    throw new Error("The API returned an incomplete or invalid spread catalog.");
  }
  registerRemoteSpreads(response.spreads);
  return response.spreads;
}
