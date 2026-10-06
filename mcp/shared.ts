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
  newlyRevealed?: number[];
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

/** Position labels are public; identities and meanings of face-down cards are not. */
export function revealGuidance(view: TarotView) {
  const spread = view.reading?.spread ?? view.spreads.find(item => item.id === view.spread);
  const revealOrder = spread?.labels.map((label, index) => ({position: index + 1, label})) ?? [];
  return {
    revealOrder,
    nextReveal: revealOrder.find(item => !view.revealed.includes(item.position)),
    newlyRevealed: (view.newlyRevealed ?? []).filter(position => view.revealed.includes(position)),
    canInterpretRevealed: view.revealed.length > 0,
  };
}
