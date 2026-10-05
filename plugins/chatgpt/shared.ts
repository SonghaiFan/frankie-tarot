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

export interface TarotView extends TarotPayload {
  /** Stable interaction slot within a chat; separate from an individual draw. */
  flowId?: string;
  sessionToken?: string;
  stage: "intro" | "input" | "picking" | "reveal" | "ready" | "result";
  question?: string;
  spread?: string;
  revealed: number[];
  interpretation?: string;
  resultIntent?: 'interpret' | 'save';
  view: "table" | "result";
  cardFaceStyle?: "original" | "redraw" | "dreamy";
}
export function nextAction(view: TarotView) {
  if (view.stage === 'result' || view.interpretation) return 'read_result' as const;
  if (!view.reading) return 'choose_spread' as const;
  if (view.revealed.length === view.reading.cards.length) return 'request_interpretation' as const;
  return view.stage === 'picking' ? 'pick_cards' as const : 'reveal_cards' as const;
}
