/** Serializable contract shared by the MCP tools and the embedded card table. */
export type Locale = "en" | "zh-CN";

export interface TarotSpread {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  labels: string[];
}

export interface TarotView {
  locale: Locale;
  spreads: TarotSpread[];
  /** Stable interaction slot within a chat; actual cards live only in the UI. */
  flowId: string;
  restoreRequested: boolean;
  stage: 'intro' | 'input';
  question?: string;
  spread?: string;
}
