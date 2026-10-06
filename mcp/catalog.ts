import { z } from 'zod';
import groundTruth from '../src/features/tarot/data/ground-truth.json';
import type { Locale, TarotSpread } from './shared';

const sourceSpreads = groundTruth.spreads.byId;
export const SPREAD_IDS = groundTruth.spreads.allIds.filter(id => id !== 'AUTO') as [string, ...string[]];
export const localeSchema = z.enum(['en', 'zh-CN']);
export const spreadSchema = z.object({
  id:z.string(), name:z.string(), description:z.string(),
  cardCount:z.number().int().positive(), labels:z.array(z.string()),
});

export function listSpreads(locale: Locale): TarotSpread[] {
  return SPREAD_IDS.map((id) => {
    const spread = sourceSpreads[id];
    const labels = (spread.layout.type === "absolute"
      ? spread.layout.positionLabels[locale]
      : spread.layout.labels[locale]) ?? [];
    return { id, name: spread.name[locale], description: spread.description[locale],
      cardCount: spread.cardCount, labels: [...labels] };
  });
}

