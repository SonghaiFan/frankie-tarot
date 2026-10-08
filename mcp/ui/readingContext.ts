import { completeReadingContext } from '@/host/readingContext';
import type { TarotAppSnapshot } from '@/host/tarotHost';

export { cardContext, completeReadingContext } from '@/host/readingContext';
export { restoreSnapshot } from "@/host/readingSnapshot";

/** Never apply a delayed model response to another draw or an incomplete spread. */
export function applyReadingSummary(state: TarotAppSnapshot | undefined, summary: {readingId:string;text:string}) {
  if (!state || state.readingId !== summary.readingId || !summary.text.trim() || summary.text.length > 800 || !state.spread) {
    throw new Error('This summary does not match the current reading.');
  }
  completeReadingContext({question:state.question,spread:state.spread,cards:state.pickedCards,revealedCardIds:state.revealedCardIds,locale:'en'});
  return {...state,readingText:summary.text.trim(),summaryRequested:true};
}
