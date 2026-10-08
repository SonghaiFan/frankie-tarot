import type { TarotCard } from "@/features/tarot/types";
import { registerRemoteCards } from "@/features/tarot/constants/cards";
import { registerRemoteSpreads, type ApiSpread } from "@/features/tarot/constants/spreads";

export type ApiLocale = "en" | "zh-CN";

export const TAROT_API_BASE = (import.meta.env.VITE_TAROT_API_URL || "").replace(/\/$/, "");
const apiCardIndices = new Map<string, number>();

export interface ApiCard {
  id: string;
  names: { en: string; "zh-CN": string };
  imageUrls: { redraw: string; dreamy: string; original: string };
  keywords: { en: string[]; "zh-CN": string[] };
  description: { en: string; "zh-CN": string };
  meanings: { upright: { en: string; "zh-CN": string }; reversed: { en: string; "zh-CN": string } };
}

export interface ApiReadingSnapshot {
  readingId: string;
  datasetVersion: string;
  algorithmVersion: string;
  seed: string;
  spreadId: string;
  drawLocale: ApiLocale;
  reversedProbability: number;
  cards: Array<{ positionIndex: number; positionLabel: string; cardId: string; orientation: "UPRIGHT" | "REVERSED" }>;
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
    imageUrls: card.imageUrls,
    positiveEn: card.meanings.upright.en,
    positive: card.meanings.upright["zh-CN"],
    negativeEn: card.meanings.reversed.en,
    negative: card.meanings.reversed["zh-CN"],
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TAROT_API_BASE}${path}`, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Tarot API returned ${response.status}.`);
  return payload as T;
}

export async function loadApiDeck(locale: ApiLocale) {
  const cards: ApiCard[] = [];
  let total: number | undefined;
  while (total === undefined || cards.length < total) {
    const page = await apiRequest<{ cards: ApiCard[]; total: number; offset: number; limit: number }>(
      `/api/v1/cards?locale=${encodeURIComponent(locale)}&offset=${cards.length}`
    );
    if (!Number.isInteger(page.total) || page.total < 1 || page.offset !== cards.length ||
      !Number.isInteger(page.limit) || page.limit < 1 || !page.cards.length ||
      (total !== undefined && page.total !== total)) {
      throw new Error("The API returned an incomplete or invalid card catalog.");
    }
    total = page.total;
    cards.push(...page.cards);
    if (cards.length > total) throw new Error("The API returned too many cards for its catalog.");
  }
  if (new Set(cards.map((card) => card.id)).size !== cards.length) {
    throw new Error("The API returned duplicate cards in its catalog.");
  }
  apiCardIndices.clear();
  cards.forEach((card, index) => apiCardIndices.set(card.id, index));
  const mappedCards = cards.map((card, index) => toTarotCard(card, index));
  registerRemoteCards(mappedCards);
  return { cards: mappedCards, total };
}

export async function loadApiSpreads(locale: ApiLocale) {
  const response = await apiRequest<{ spreads: ApiSpread[]; locale: ApiLocale }>(`/api/v1/spreads?locale=${encodeURIComponent(locale)}`);
  if (!response.spreads.length || new Set(response.spreads.map((spread) => spread.id)).size !== response.spreads.length) {
    throw new Error("The API returned an incomplete or invalid spread catalog.");
  }
  registerRemoteSpreads(response.spreads);
  return response.spreads;
}

export async function drawApiReading(input: { question: string; spread: string; locale: ApiLocale; seed: string }) {
  return apiRequest<{ reading: ApiReadingSnapshot; context: { cards: Array<{ card: ApiCard; orientation: "UPRIGHT" | "REVERSED" }> } }>("/api/v1/readings/draw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getApiReadingContext(reading: ApiReadingSnapshot, question: string, locale: ApiLocale) {
  return apiRequest<Record<string, unknown>>("/api/v1/readings/context", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reading, question, locale }),
  });
}
