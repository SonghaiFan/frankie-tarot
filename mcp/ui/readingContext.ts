import { getLocalizedSpread, SPREADS } from '@/features/tarot/constants/spreads';
import { FULL_DECK } from '@/features/tarot/constants/cards';
import { GameState } from '@/features/tarot/types';
import type { TarotAppSnapshot, TarotCardContext, TarotReadingRequest } from '@/host/tarotHost';

export function cardContext({question, spread, card, position, locale}: TarotCardContext) {
  const definition = getLocalizedSpread(spread, locale);
  return {
    question, spread: {id:spread,name:definition.name},
    card: {name:locale === 'en' ? card.nameEn : card.nameCn,
      nameEn:card.nameEn, position,
      positionLabel:definition.positions?.[position - 1]?.label ?? definition.labels?.[position - 1] ?? String(position),
      isReversed:card.isReversed},
  };
}
export function completeReadingContext(reading: TarotReadingRequest) {
  const definition = SPREADS[reading.spread];
  if (!definition || reading.spread === 'AUTO' || reading.cards.length !== definition.cardCount ||
    new Set(reading.cards.map(card=>card.id)).size !== reading.cards.length ||
    !reading.cards.every(card=>reading.revealedCardIds.includes(card.id))) {
    throw new Error('Reveal every card in this spread before requesting interpretation.');
  }
  return {
    question:reading.question,
    spread:cardContext({...reading,card:reading.cards[0],position:1}).spread,
    cards:reading.cards.map((card,index)=>cardContext({...reading,card,position:index+1}).card),
  };
}

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
    return {...state,pickedCards,drawTargets};
  } catch { return; }
}

/** Never apply a delayed model response to another draw or an incomplete spread. */
export function applyReadingSummary(state: TarotAppSnapshot | undefined, summary: {readingId:string;text:string}) {
  if (!state || state.readingId !== summary.readingId || !summary.text.trim() || summary.text.length > 800 || !state.spread) {
    throw new Error('This summary does not match the current reading.');
  }
  completeReadingContext({question:state.question,spread:state.spread,cards:state.pickedCards,revealedCardIds:state.revealedCardIds,locale:'en'});
  return {...state,readingText:summary.text.trim(),summaryRequested:true};
}
