/** Serializable contract shared by the MCP tools and the embedded card table. */
export type Locale = "en" | "zh-CN";

export interface TarotSpread {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  labels: string[];
}

export interface TarotReading {
  id: string;
  createdAt: string;
  question: string;
  locale: Locale;
  spread: TarotSpread;
  cards: Array<{
    id: number;
    name: string;
    nameEn: string;
    nameCn: string;
    position: number;
    positionLabel: string;
    isReversed: boolean;
    imageUrl: string;
    originalImageUrl: string;
    keywords: string[];
    meaning: string;
    description: string;
  }>;
}

export interface TarotPayload {
  locale: Locale;
  spreads: TarotSpread[];
  reading?: TarotReading;
  readingToken?: string;
}
