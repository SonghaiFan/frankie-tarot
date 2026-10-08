import { TarotCard, CardPoolType, CardFaceStyle } from "@/features/tarot/types";

const baseUrl = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
const localImages = {
  redraw: `${baseUrl}images/cards/`,
  dreamy: `${baseUrl}images/cards_dreamy/`,
  original: `${baseUrl}images/cards_rws_original/`,
};
const remoteCards = new Map<number, TarotCard>();
const remoteImages = new Map<string, { redraw: string; dreamy: string; original: string }>();
export const FULL_DECK: TarotCard[] = [];
export const MAJOR_ARCANA: TarotCard[] = [];
export const MINOR_ARCANA: TarotCard[] = [];

/** Populate the visual catalogue only from the configured public API. */
export function registerRemoteCards(cards: TarotCard[]) {
  remoteCards.clear();
  remoteImages.clear();
  FULL_DECK.splice(0, FULL_DECK.length, ...cards);
  MAJOR_ARCANA.splice(0, MAJOR_ARCANA.length, ...cards.filter((card) => card.id < 22));
  MINOR_ARCANA.splice(0, MINOR_ARCANA.length, ...cards.filter((card) => card.id >= 22));
  for (const card of cards) {
    remoteCards.set(card.id, card);
    if (card.imageUrls) remoteImages.set(card.image.replace(/\.[^/.]+$/, ""), card.imageUrls);
  }
}

export const registerRemoteCardImages = (cards: Array<{ id: string; imageUrls: { redraw: string; dreamy: string; original: string } }>) => {
  for (const card of cards) remoteImages.set(card.id, card.imageUrls);
};

export const getCardImageUrl = (imageOrKey: string, style: CardFaceStyle = "redraw"): string => {
  if (!imageOrKey) return "";
  if (/^https?:\/\//.test(imageOrKey) || imageOrKey.startsWith("/")) return imageOrKey;
  const key = imageOrKey.replace(/\.[^/.]+$/, "");
  const imageSet = remoteImages.get(key);
  if (imageSet && (style === "redraw" || style === "dreamy" || style === "original")) return imageSet[style];
  const directory = style === "original" ? localImages.original : style === "dreamy" ? localImages.dreamy : localImages.redraw;
  return `${directory}${key}.webp`;
};

export const getDeckForPool = (pool: CardPoolType): TarotCard[] => {
  if (pool === "MAJOR") return MAJOR_ARCANA;
  if (pool === "MINOR_PIP") return MINOR_ARCANA.filter((card) => !/^(Page|Knight|Queen|King)\b/.test(card.nameEn));
  if (pool === "COURT") return MINOR_ARCANA.filter((card) => /^(Page|Knight|Queen|King)\b/.test(card.nameEn));
  if (pool.startsWith("SUIT_")) return MINOR_ARCANA.filter((card) => card.nameEn.includes(pool.slice(5)));
  return FULL_DECK;
};

export { TAROT_CARD_DIMENSIONS, CARD_ASPECT_RATIO, CARD_ASPECT_CLASS } from "./cardDimensions";
export type { CardDimensionConfig } from "./cardDimensions";
