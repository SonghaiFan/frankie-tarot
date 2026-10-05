import type { PickedCard, SpreadType, Locale } from '@/features/tarot/types';
export interface HostedReading {
  id: string;
  question: string;
  spread: SpreadType;
  cards: PickedCard[];
  stage?: "picking" | "reveal" | "ready" | "result";
  revealedCardIds?: number[];
  interpretation?: string;
}
export interface TarotHost {
  expand?(): Promise<void>;
  draw(question: string, spread: SpreadType, locale: Locale): Promise<HostedReading>;
  interpret(locale: Locale, reflection?: string): Promise<void>;
  reportState?(state: {stage: string; question: string; spread: SpreadType | null; revealedCardIds: number[]; pickedCount: number; cardFaceStyle: string}): Promise<void>;
}
