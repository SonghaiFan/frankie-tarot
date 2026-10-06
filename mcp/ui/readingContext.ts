import { getLocalizedSpread, SPREADS } from '@/features/tarot/constants/spreads';
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

export { restoreSnapshot } from "@/host/readingSnapshot";

/** Never apply a delayed model response to another draw or an incomplete spread. */
export function applyReadingSummary(state: TarotAppSnapshot | undefined, summary: {readingId:string;text:string}) {
  if (!state || state.readingId !== summary.readingId || !summary.text.trim() || summary.text.length > 800 || !state.spread) {
    throw new Error('This summary does not match the current reading.');
  }
  completeReadingContext({question:state.question,spread:state.spread,cards:state.pickedCards,revealedCardIds:state.revealedCardIds,locale:'en'});
  return {...state,readingText:summary.text.trim(),summaryRequested:true};
}
