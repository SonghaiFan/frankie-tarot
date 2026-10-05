import type { PickedCard, SpreadType, Locale } from '@/features/tarot/types';
export interface HostedReading {
  id: string;
  question: string;
  spread: SpreadType;
  cards: PickedCard[];
}
export interface TarotHost {
  expand?(): Promise<void>;
  draw(question: string, spread: SpreadType, locale: Locale): Promise<HostedReading>;
  interpret(locale: Locale): Promise<void>;
}
