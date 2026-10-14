import type { ApiSpread } from "@/features/tarot/constants/spreads";
import type { PickedCard, SpreadType, Locale, CardFaceStyle, GameState } from '@/features/tarot/types';
export interface ReadingImage { name: string; dataUrl: string; }
export interface SavedReadingImage { destination: 'download' | 'library'; name: string; downloadUrl?: string; }
/** UI-only recovery data; never attach this snapshot to model context. */
export interface TarotAppSnapshot {
  version: 1;
  /** API-owned spread semantics and prompt pinned to this table. */
  spreadDefinition?: ApiSpread;
  readingText?: string;
  summaryRequested?: boolean;
  readingId?: string;
  stage: GameState;
  question: string;
  spread: SpreadType | null;
  pickedCards: PickedCard[];
  /** Full private face-down table, never included in model context. */
  dealtCards?: PickedCard[];
  revealedCardIds: number[];
  cardFaceStyle: CardFaceStyle;
}
export interface TarotReadingRequest {
  spreadDefinition?: ApiSpread;
  readingId?: string;
  question: string;
  spread: SpreadType;
  cards: PickedCard[];
  revealedCardIds: number[];
  locale: Locale;
}
export interface TarotCardContext {
  spreadDefinition?: ApiSpread;
  question: string;
  spread: SpreadType;
  card: PickedCard;
  position: number;
  locale: Locale;
}
export interface TarotHost {
  expand?(): Promise<void>;
  requestSpread?(question: string, locale: Locale): Promise<void>;
  summarize?(reading: TarotReadingRequest): Promise<void>;
  interpret(reading: TarotReadingRequest): Promise<void>;
  attachCard?(selection: TarotCardContext): Promise<void>;
  saveResult(locale: Locale, readingText: string, image: ReadingImage): Promise<SavedReadingImage>;
  reportState?(state: TarotAppSnapshot): Promise<void>;
}
