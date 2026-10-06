import { z } from 'zod';
import { localeSchema, spreadSchema } from './catalog';
import type { TarotView } from './shared';

export const flowSchema = z.object({
  locale: localeSchema, spreads: z.array(spreadSchema),
  question: z.string(), spread: z.string().optional(), flowId: z.string().uuid().optional(),
});
export function publicState(view: TarotView) {
  // Launch information only. Card identities and reveal progress stay in the UI.
  return {
    locale: view.locale, spreads: view.spreads,
    question: view.question ?? '',
    spread: view.spread, flowId: view.flowId,
  };
}
export function viewResult(view: TarotView) {
  return {
    structuredContent: publicState(view),
    _meta: { tarot: view, ...(view.flowId ? {'openai/widgetSessionId': view.flowId} : {}) },
    content: [{type:'text' as const, text:
      'Setup data is prepared for the original interactive table. This tool result does not confirm that ChatGPT successfully rendered it or restored its private state. Wait for the user to start, select and flip in the UI. Do not track reveal progress, infer hidden cards or automatically interpret selected-card context. An explicit Interpret request is answered directly in chat.'}],
  };
}
