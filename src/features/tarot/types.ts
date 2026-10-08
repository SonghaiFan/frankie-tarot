export enum GameState {
  INTRO = "INTRO",
  INPUT = "INPUT",
  PICKING = "PICKING",
  REVEAL = "REVEAL",
  READING = "READING",
  LIBRARY = "LIBRARY",
}

/** Opaque identifier owned by the configured API, never a local catalog. */
export type SpreadType = string;

export type { Locale } from "@/i18n/types";

/** Opaque API value, retained only when passing API metadata through the UI. */
export type CardPoolType = string;

export interface TarotCard {
  id: number;
  nameEn: string;
  nameCn: string;
  descriptionCn?: string;
  descriptionEn?: string;
  keywords: string[];
  keywordsEn?: string[];
  image: string; // Local asset filename
  imageUrls?: { redraw: string; dreamy: string; original: string };
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
