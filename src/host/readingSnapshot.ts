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
    !Array.isArray(state.pickedCards) || !Array.isArray(state.revealedCardIds)) return;
  const normalize = (values: TarotAppSnapshot['pickedCards']) => values.map(value => {
    if (!value || !Number.isInteger(value.id) || typeof value.nameEn !== 'string' ||
      typeof value.nameCn !== 'string' || typeof value.image !== 'string' || typeof value.isReversed !== 'boolean') {
      throw new Error('Invalid saved card');
    }
    return {...value,isReversed:value.isReversed,visualId:value.visualId};
  });
  try {
    if (state.spreadDefinition) {
      const def = state.spreadDefinition;
      if (def.id !== state.spread || !Number.isInteger(def.cardCount) || def.cardCount < 1 ||
        !def.names || typeof def.names.en !== 'string' || typeof def.names['zh-CN'] !== 'string' ||
        !def.descriptions || typeof def.descriptions.en !== 'string' || typeof def.descriptions['zh-CN'] !== 'string' ||
        !def.layout || !['flex','absolute'].includes(def.layout.type) ||
        !def.labelsByLocale || !['en','zh-CN'].every(locale => Array.isArray(def.labelsByLocale[locale]) && def.labelsByLocale[locale].length === def.cardCount && def.labelsByLocale[locale].every(label => typeof label === 'string')) ||
        (def.layout.type === 'absolute' && (!Array.isArray(def.layout.positions) || def.layout.positions.length !== def.cardCount || def.layout.positions.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) ||
        !def.interpretationInstructions || typeof def.interpretationInstructions.en !== 'string' || typeof def.interpretationInstructions['zh-CN'] !== 'string' ||
        (def.interpretationProfile && (typeof def.interpretationProfile.id !== 'string' || !def.interpretationProfile.templates || typeof def.interpretationProfile.templates.en !== 'string' || typeof def.interpretationProfile.templates['zh-CN'] !== 'string'))) return;
    }
    const pickedCards = normalize(state.pickedCards);
    if (new Set(pickedCards.map(c=>c.id)).size !== pickedCards.length ||
      !state.revealedCardIds.every(id=>pickedCards.some(c=>c.id===id))) return;
    if ([GameState.PICKING,GameState.READING,GameState.REVEAL].includes(state.stage)) {
      // The remote catalog is empty on a fresh page, so restore from the saved
      // picks alone; the app finishes a pick it sees completed once spreads load.
      if (typeof state.readingId !== 'string' || !state.readingId || !state.spread ||
        (state.stage !== GameState.PICKING && pickedCards.length < 1)) return;
    }
    if (state.dealtCards !== undefined) {
      if (!Array.isArray(state.dealtCards) || state.dealtCards.length < 1) return;
      const dealt = normalize(state.dealtCards);
      if (dealt.some(card => !Number.isInteger(card.visualId)) ||
        new Set(dealt.map(card => card.visualId)).size !== dealt.length ||
        new Set(dealt.map(card => card.id)).size !== dealt.length ||
        new Set(dealt.map(card => card.image)).size !== dealt.length ||
        pickedCards.some(card => !dealt.some(tile => tile.visualId === card.visualId &&
          tile.image === card.image && tile.id === card.id && tile.isReversed === card.isReversed))) return;
    }
    const { drawTargets: _legacy, ...rest } = state as TarotAppSnapshot & { drawTargets?: unknown };
    return {...rest,pickedCards};
  } catch { return; }
}
