export enum GameState {
  INTRO = "INTRO",
  INPUT = "INPUT",
  PICKING = "PICKING",
  REVEAL = "REVEAL",
  READING = "READING",
  LIBRARY = "LIBRARY",
}

export type SpreadType =
  | "SINGLE"
  | "THREE"
  | "FOUR"
  | "TIMELINE"
  | "DIMENSION"
  | "FIVE"
  | "RELATION"
  | "CELTIC"
  | "COURT"
  | "GOALS"
  | "YEARLY"
  | "AUTO";

export type { Locale } from "@/i18n/types";

export type CardPoolType =
  | "MAJOR"
  | "MINOR_PIP"
  | "COURT"
  | "FULL"
  | "SUIT_CUPS"
  | "SUIT_PENTACLES"
  | "SUIT_SWORDS"
  | "SUIT_WANDS";

export interface TarotCard {
  id: number;
  nameEn: string;
  nameCn: string;
  descriptionCn?: string;
  descriptionEn?: string;
  keywords: string[];
  keywordsEn?: string[];
  image: string; // Local asset filename
  positive?: string;
  negative?: string;
  positiveEn?: string;
  negativeEn?: string;
}

export interface PickedCard extends TarotCard {
  /** Identity of the face-down tile, used only for the selection animation. */
  visualId?: number;
  isReversed: boolean;
}

export interface AudioMessage {
  id: string;
  text: string;
  buffer?: AudioBuffer; // Cached buffer
}

export type CardFaceStyle = "redraw" | "dreamy" | "original" | (string & {});

export interface TarotReadingResponse {
  text: string;
}
