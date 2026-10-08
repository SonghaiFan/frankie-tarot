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
    !Array.isArray(state.pickedCards) || !Array.isArray(state.drawTargets) || !Array.isArray(state.revealedCardIds)) return;
  const normalize = (values: TarotAppSnapshot['pickedCards']) => values.map(value => {
    if (!value || !Number.isInteger(value.id) || typeof value.nameEn !== 'string' ||
      typeof value.nameCn !== 'string' || typeof value.image !== 'string' || typeof value.isReversed !== 'boolean') {
      throw new Error('Invalid saved card');
    }
    return {...value,isReversed:value.isReversed,visualId:value.visualId};
  });
  try {
    const pickedCards = normalize(state.pickedCards), drawTargets = normalize(state.drawTargets);
    if (new Set(pickedCards.map(c=>c.id)).size !== pickedCards.length ||
      new Set(drawTargets.map(c=>c.id)).size !== drawTargets.length ||
      !state.revealedCardIds.every(id=>pickedCards.some(c=>c.id===id))) return;
    if ([GameState.PICKING,GameState.READING,GameState.REVEAL].includes(state.stage)) {
      // The remote catalog is empty on a fresh page. Restore private UI state
      // first; the API validates its reading snapshot when context is requested.
      const expectedCount = state.apiReading?.cards.length ?? 0;
      if (!state.apiReading || state.apiReading.readingId !== state.readingId || !state.spread ||
        state.apiReading.spreadId !== state.spread || expectedCount < 1 || drawTargets.length !== expectedCount ||
        pickedCards.length > drawTargets.length ||
        !pickedCards.every((card,i)=>card.id===drawTargets[i].id && card.isReversed===drawTargets[i].isReversed) ||
        (state.stage !== GameState.PICKING && pickedCards.length !== drawTargets.length)) return;
    }
    const stage = state.stage === GameState.PICKING && pickedCards.length === drawTargets.length && pickedCards.length > 0
      ? GameState.READING : state.stage;
    return {...state,stage,pickedCards,drawTargets};
  } catch { return; }
}
