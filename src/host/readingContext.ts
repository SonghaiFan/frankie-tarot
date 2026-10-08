import { getLocalizedSpread, SPREADS } from '@/features/tarot/constants/spreads';
import type { TarotCardContext, TarotReadingRequest } from './tarotHost';

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

/** The whole revealed spread, with each card's meaning for its orientation, built from the drawn cards. */
export function completeReadingContext(reading: TarotReadingRequest) {
  const definition = SPREADS[reading.spread];
  if (!definition || reading.spread === 'AUTO' || reading.cards.length !== definition.cardCount ||
    new Set(reading.cards.map(card=>card.id)).size !== reading.cards.length ||
    !reading.cards.every(card=>reading.revealedCardIds.includes(card.id))) {
    throw new Error('Reveal every card in this spread before requesting interpretation.');
  }
  const isEnglish = reading.locale === 'en';
  return {
    question:reading.question,
    spread:{...cardContext({...reading,card:reading.cards[0],position:1}).spread,
      interpretationInstruction:getLocalizedSpread(reading.spread, reading.locale).interpretationInstruction},
    cards:reading.cards.map((card,index)=>({...cardContext({...reading,card,position:index+1}).card,
      keywords:isEnglish ? card.keywordsEn ?? [] : card.keywords,
      meaning:card.isReversed ? (isEnglish ? card.negativeEn : card.negative) : (isEnglish ? card.positiveEn : card.positive)})),
  };
}
