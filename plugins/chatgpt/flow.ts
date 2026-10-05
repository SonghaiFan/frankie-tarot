import { z } from 'zod';
import { localeSchema, spreadSchema, readingSchema, type TarotEngine } from './engine';
import type { TarotView, Locale } from './shared';
import { readingPrompts } from './prompts';

export const flowSchema = z.object({
  locale: localeSchema, spreads: z.array(spreadSchema),
  stage: z.enum(['intro','input','picking','reveal','ready','result']),
  view: z.enum(['table','result']), question: z.string(), spread: z.string().optional(),
  readingId: z.string().optional(), sessionToken: z.string().optional(),
  revealed: z.array(z.number()), cardCount: z.number(),
  cards: readingSchema.shape.cards, canInterpret: z.boolean(),
  interpretation: z.string().optional(), cardFaceStyle: z.enum(["original","redraw","dreamy"]).optional(),
  interpretationPrompt: z.string().optional(), followUpPrompt: z.string().optional(),
});
export function publicState(view: TarotView) {
  return {
    locale: view.locale, spreads: view.spreads, stage: view.stage, view: view.view,
    question: view.reading?.question ?? view.question ?? '', spread: view.reading?.spread.id ?? view.spread,
    readingId: view.reading?.id, sessionToken: view.sessionToken, revealed: view.revealed,
    cardCount: view.reading?.cards.length ?? 0,
    cards: view.reading?.cards.filter(card => view.revealed.includes(card.position)) ?? [],
    canInterpret: !!view.reading && view.revealed.length === view.reading.cards.length,
    interpretation: view.interpretation, cardFaceStyle: view.cardFaceStyle,
    ...readingPrompts(view),
  };
}
export function viewResult(view: TarotView) {
  const state = publicState(view);
  return {
    structuredContent: state,
    // Only the app receives the complete draw. Never copy this into model context.
    _meta: { tarot: view },
    content: [{type:'text' as const, text: view.view === 'result'
      ? view.resultIntent === 'interpret'
        ? 'The brief initial interpretation is now in the shared result card. Next use followUpPrompt to give deeper analysis in the ordinary assistant response OUTSIDE the app. Do not repeat the brief paragraph, call show_tarot_result again with the deeper text, replace the result card, or redraw.'
        : `Saved this existing reading as a result card. Preserve its cards, artwork and any provided interpretation. Do not add an interpretation unless explicitly requested. Do not run followUpPrompt on a save request.`
      : state.canInterpret
      ? `All ${state.cardCount} cards are revealed. Keep this reading and its positions unchanged. Interpret only when requested: follow interpretationPrompt for one brief paragraph, call show_tarot_result with intent="interpret", then use its followUpPrompt for deeper analysis outside the app.`
      : `Stage: ${state.stage}. ${state.revealed.length}/${state.cardCount} cards revealed. Do not interpret, name hidden cards, or infer a reading. Guide the user to select/reveal in the table. A question alone opens setup; it is not permission to skip the ritual.`}],
  };
}
export function restoreView(engine: TarotEngine, sessionToken: string, locale?: Locale): TarotView {
  const session = engine.openSession(sessionToken);
  const payload = engine.restore(session.readingToken, locale);
  return {...payload, sessionToken, revealed: session.revealed,
    stage: session.revealed.length === payload.reading!.cards.length ? 'ready' : 'reveal', view:'table'};
}
