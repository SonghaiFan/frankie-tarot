import { SPREADS } from "@/features/tarot/constants/spreads";
import { FULL_DECK } from "@/features/tarot/constants/cards";
import { GameState } from "@/features/tarot/types";
import type { TarotAppSnapshot } from "./tarotHost";

/** Validate persisted UI state and rebuild cards from the canonical deck. */
export function restoreSnapshot(value: unknown): TarotAppSnapshot | undefined {
  if (!value || typeof value !== 'object') return;
  const state = value as TarotAppSnapshot;
  if (state.version !== 1 || typeof state.question !== 'string' ||
    (state.readingText !== undefined && (typeof state.readingText !== 'string' || state.readingText.length > 800)) ||
    (state.summaryRequested !== undefined && typeof state.summaryRequested !== 'boolean') ||
    !Object.values(GameState).includes(state.stage) ||
    (state.spread !== null && !Object.hasOwn(SPREADS,state.spread)) ||
    !['original','redraw','dreamy'].includes(state.cardFaceStyle) ||
    !Array.isArray(state.pickedCards) || !Array.isArray(state.drawTargets) || !Array.isArray(state.revealedCardIds)) return;
  const normalize = (values: TarotAppSnapshot['pickedCards']) => values.map(value => {
    const card = FULL_DECK.find(card=>card.id===value?.id);
    if (!card || typeof value.isReversed !== 'boolean') throw new Error('Invalid saved card');
    return {...card,isReversed:value.isReversed,visualId:value.visualId};
  });
  try {
    const pickedCards = normalize(state.pickedCards), drawTargets = normalize(state.drawTargets);
    if (new Set(pickedCards.map(c=>c.id)).size !== pickedCards.length ||
      new Set(drawTargets.map(c=>c.id)).size !== drawTargets.length ||
      !state.revealedCardIds.every(id=>pickedCards.some(c=>c.id===id))) return;
    if ([GameState.PICKING,GameState.READING,GameState.REVEAL].includes(state.stage)) {
      if (!state.spread || state.spread === 'AUTO' || drawTargets.length !== SPREADS[state.spread].cardCount ||
        pickedCards.length > drawTargets.length ||
        !pickedCards.every((card,i)=>card.id===drawTargets[i].id && card.isReversed===drawTargets[i].isReversed) ||
        (state.stage !== GameState.PICKING && pickedCards.length !== drawTargets.length)) return;
    }
    const stage = state.stage === GameState.PICKING && pickedCards.length === drawTargets.length && pickedCards.length > 0
      ? GameState.READING : state.stage;
    return {...state,stage,pickedCards,drawTargets};
  } catch { return; }
}
