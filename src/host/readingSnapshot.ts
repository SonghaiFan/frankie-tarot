import { GameState } from "@/features/tarot/types";
import type { TarotAppSnapshot } from "./tarotHost";

/** Validate caller-held UI recovery state without consulting a local card dataset. */
export function restoreSnapshot(value: unknown): TarotAppSnapshot | undefined {
  if (!value || typeof value !== 'object') return;
  const state = value as TarotAppSnapshot;
  if (state.version !== 1 || typeof state.question !== 'string' ||
    (state.readingText !== undefined && (typeof state.readingText !== 'string' || state.readingText.length > 800)) ||
    (state.summaryRequested !== undefined && typeof state.summaryRequested !== 'boolean') ||
    !Object.values(GameState).includes(state.stage) ||
    (state.spread !== null && (typeof state.spread !== 'string' || !state.spread)) ||
    !['original','redraw','dreamy'].includes(state.cardFaceStyle) ||
    !Array.isArray(state.pickedCards) || !Array.isArray(state.revealedCardIds)) return;
  const normalize = (values: TarotAppSnapshot['pickedCards']) => values.map(value => {
    if (!value || !Number.isInteger(value.id) || typeof value.nameEn !== 'string' ||
      typeof value.nameCn !== 'string' || typeof value.image !== 'string' || typeof value.isReversed !== 'boolean') {
      throw new Error('Invalid saved card');
    }
    return {...value,isReversed:value.isReversed,visualId:value.visualId};
  });
  try {
    const pickedCards = normalize(state.pickedCards);
    if (new Set(pickedCards.map(c=>c.id)).size !== pickedCards.length ||
      !state.revealedCardIds.every(id=>pickedCards.some(c=>c.id===id))) return;
    if ([GameState.PICKING,GameState.READING,GameState.REVEAL].includes(state.stage)) {
      // The remote catalog is empty on a fresh page, so restore from the saved
      // picks alone; the app finishes a pick it sees completed once spreads load.
      if (typeof state.readingId !== 'string' || !state.readingId || !state.spread ||
        (state.stage !== GameState.PICKING && pickedCards.length < 1)) return;
    }
    const { drawTargets: _legacy, ...rest } = state as TarotAppSnapshot & { drawTargets?: unknown };
    return {...rest,pickedCards};
  } catch { return; }
}
