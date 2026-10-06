import { z } from 'zod';
import { localeSchema, spreadSchema, readingSchema, type TarotEngine } from './engine';
import { nextAction, revealGuidance, type TarotView, type Locale } from './shared';
import { readingPrompts } from './prompts';

export const flowSchema = z.object({
  locale: localeSchema, spreads: z.array(spreadSchema),
  stage: z.enum(['intro','input','picking','reveal','ready','result']),
  view: z.enum(['table','result']), question: z.string(), spread: z.string().optional(),
  readingId: z.string().optional(), sessionToken: z.string().optional(),
  flowId: z.string().uuid().optional(),
  nextAction: z.enum(['choose_spread','pick_cards','reveal_cards','request_interpretation','read_result']),
  revealOrder: z.array(z.object({position:z.number(),label:z.string()})),
  nextReveal: z.object({position:z.number(),label:z.string()}).optional(),
  newlyRevealed: z.array(z.number()), canInterpretRevealed: z.boolean(),
  revealed: z.array(z.number()), cardCount: z.number(),
  cards: readingSchema.shape.cards, canInterpret: z.boolean(),
  interpretation: z.string().optional(), cardFaceStyle: z.enum(["original","redraw","dreamy"]).optional(),
  interpretationPrompt: z.string().optional(), followUpPrompt: z.string().optional(),
});
export function publicState(view: TarotView) {
  return {
    locale: view.locale, spreads: view.spreads, stage: view.stage, view: view.view,
    question: view.reading?.question ?? view.question ?? '', spread: view.reading?.spread.id ?? view.spread,
    readingId: view.reading?.id, sessionToken: view.sessionToken, flowId: view.flowId, revealed: view.revealed,
    nextAction: nextAction(view),
    ...revealGuidance(view),
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
    _meta: { tarot: view, ...(view.flowId ? {'openai/widgetSessionId': view.flowId} : {}) },
    content: [{type:'text' as const, text: view.stage === 'result'
      ? 'Updated the existing table. Preserve this draw. Do not add an interpretation unless explicitly requested. Do not run followUpPrompt on a save request. Further answers belong in ordinary chat; no automatic follow-up is required.'
      : !view.reading
      ? 'Setup data is prepared for the interactive table. This tool result does not confirm that ChatGPT successfully rendered it. Do not claim the table is open if the host shows a loading error; acknowledge the error and suggest Retry. Once the table is visible, suggest the side tab / expanded view if available. Wait for the user to shuffle and pick cards. Explain revealOrder without revealing identities.'
      : `Stage: ${state.stage}. ${state.revealed.length}/${state.cardCount} cards revealed. When responding, briefly interpret newly revealed cards using their positions and orientations, unless the user asked to wait. Do not repeat cards already discussed. Never infer hidden cards. ${state.nextReveal ? `Next position: ${state.nextReveal.position} — ${state.nextReveal.label}. Wait for the user to flip it.` : 'All cards are visible. Offer 深入解读 / Explore deeper for the full interpretationPrompt, answered directly in chat without a result-tool call.'} App context updates do not themselves start an assistant turn; never manufacture user messages to trigger one.`}],
  };
}
export function restoreView(engine: TarotEngine, sessionToken: string, locale?: Locale): TarotView {
  const session = engine.openSession(sessionToken);
  const payload = engine.restore(session.readingToken, locale);
  return {...payload, sessionToken, flowId: session.flowId ?? payload.reading!.id, revealed: session.revealed,
    stage: session.revealed.length === payload.reading!.cards.length ? 'ready' : 'reveal', view:'table'};
}
