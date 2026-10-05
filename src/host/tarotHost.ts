import type { PickedCard, SpreadType, Locale, CardFaceStyle } from '@/features/tarot/types';
export interface HostedReading {
  id: string;
  question: string;
  spread: SpreadType;
  cards: PickedCard[];
  stage?: "picking" | "reveal" | "ready" | "result";
  revealedCardIds?: number[];
  interpretation?: string;
  cardFaceStyle?: CardFaceStyle;
}
export interface ReadingImage { name: string; dataUrl: string; }
export interface SavedReadingImage { destination: 'download' | 'library'; name: string; downloadUrl?: string; }
export interface TarotHost {
  expand?(): Promise<void>;
  draw(question: string, spread: SpreadType, locale: Locale): Promise<HostedReading>;
  interpret(locale: Locale): Promise<void>;
  saveResult(locale: Locale, readingText: string, image: ReadingImage): Promise<SavedReadingImage>;
  reportState?(state: {stage: string; question: string; spread: SpreadType | null; revealedCardIds: number[]; pickedCount: number; cardFaceStyle: string}): Promise<void>;
}
