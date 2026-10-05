import { FULL_DECK } from '../../src/features/tarot/constants/cards';
import { buildTarotReadingPrompt, buildTarotFollowUpPrompt } from '../../src/core/promptBuilder';
import type { SpreadType } from '../../src/features/tarot/types';
import type { TarotView } from './shared';

/** Share the website's initial reading and copied follow-up prompts. */
export function readingPrompts(view: TarotView) {
  const reading = view.reading;
  // These prompts contain the complete spread; never expose concealed cards.
  if (!reading || !reading.cards.every(card => view.revealed.includes(card.position))) return {};
  const options = {
    question: reading.question, spread: reading.spread.id as SpreadType, locale: view.locale,
    cards: reading.cards.map(card => {
      const original = FULL_DECK.find(item => item.id === card.id);
      if (!original) throw new Error('Unknown card');
      return {...original, isReversed: card.isReversed};
    }),
  };
  return {
    interpretationPrompt: buildTarotReadingPrompt(options),
    followUpPrompt: view.interpretation
      ? buildTarotFollowUpPrompt({...options, readingText: view.interpretation})
      : undefined,
  };
}

export function validateBriefReading(text: string | undefined, locale: TarotView['locale']) {
  if (!text?.trim()) throw new Error('Provide the brief initial interpretation following interpretationPrompt.');
  const tooLong = locale === 'en'
    ? text.trim().split(/\s+/u).length > 180
    : [...text.matchAll(/\p{Script=Han}/gu)].length > 180;
  if (tooLong || /\n\s*\n/u.test(text)) {
    throw new Error('The result card needs one concise paragraph: 120–180 Chinese characters or 130–180 English words, following interpretationPrompt. Retry with a brief reading; put deeper analysis in the ordinary chat response after the result, never inside the card.');
  }
}
