import type { ReactNode } from "react";
import type { SpreadType, CardPoolType, Locale } from "@/features/tarot/types";
import { SpreadPosition, SpreadPositionLayout, makeSpreadIcon } from "@/features/tarot/components/icons/SpreadIcons";

export type { SpreadPosition, SpreadPositionLayout };

export interface SpreadData {
  id: SpreadType;
  name_en: string; name_cn: string; description_en: string; description_cn: string;
  cardCount: number; layoutType: "flex" | "absolute"; positions?: SpreadPositionLayout[];
  positionLabels_en?: string[]; positionLabels_cn?: string[];
  labels_en?: string[]; labels_cn?: string[]; cardPools?: CardPoolType[];
  cardSize: { mobile: string; desktop: string }; icon: (isActive: boolean) => ReactNode;
  interpretationInstruction_en: string; interpretationInstruction_cn: string;
  defaultQuestions_en?: string[]; defaultQuestions_cn?: string[];
}

export interface SpreadDefinition {
  id: SpreadType; name: string; description: string; cardCount: number; layoutType: "flex" | "absolute";
  positions?: SpreadPosition[]; labels?: string[]; cardPools?: CardPoolType[];
  cardSize: { mobile: string; desktop: string }; icon: (isActive: boolean) => ReactNode;
  interpretationInstruction: string; defaultQuestions?: string[];
}

export interface ApiSpread {
  id: string; names: { en: string; "zh-CN": string };
  descriptions: { en: string; "zh-CN": string }; cardCount: number;
  labelsByLocale: { en: string[]; "zh-CN": string[] };
  cardPools: CardPoolType[]; interpretationInstructions: { en: string; "zh-CN": string };
  layout: { type: "flex" | "absolute"; positions?: SpreadPositionLayout[] | null };
  defaultQuestions?: { en?: string[]; "zh-CN"?: string[] };
}

/** API-owned catalog, populated at runtime. This module contains no spread records. */
export const SPREADS: Record<string, SpreadData> = {};

function cardSizeForCount(count: number) {
  const mobile = count <= 1 ? "w-64" : count <= 3 ? "w-28" : count <= 4 ? "w-24" : count <= 5 ? "w-20" : "w-14";
  const desktop = count <= 1 ? "w-80" : count <= 3 ? "w-56" : count <= 4 ? "w-36" : count <= 5 ? "w-32" : count <= 7 ? "w-28" : "w-24";
  return { mobile: `${mobile} aspect-[7/12]`, desktop: `${desktop} aspect-[7/12]` };
}

export function registerRemoteSpreads(remoteSpreads: ApiSpread[]) {
  for (const key of Object.keys(SPREADS)) delete SPREADS[key];
  for (const spread of remoteSpreads) {
    if (!spread.id || !Number.isInteger(spread.cardCount) || spread.cardCount < 1 ||
      !spread.layout || !["flex", "absolute"].includes(spread.layout.type) ||
      spread.labelsByLocale?.en?.length !== spread.cardCount ||
      spread.labelsByLocale?.["zh-CN"]?.length !== spread.cardCount ||
      (spread.layout.type === "absolute" && spread.layout.positions?.length !== spread.cardCount)) continue;
    const id = spread.id;
    const layoutType = spread.layout.type;
    SPREADS[id] = {
      id, name_en: spread.names.en, name_cn: spread.names["zh-CN"],
      description_en: spread.descriptions.en, description_cn: spread.descriptions["zh-CN"],
      cardCount: spread.cardCount, layoutType, positions: spread.layout.positions ?? undefined,
      positionLabels_en: layoutType === "absolute" ? spread.labelsByLocale.en : undefined,
      positionLabels_cn: layoutType === "absolute" ? spread.labelsByLocale["zh-CN"] : undefined,
      labels_en: layoutType === "flex" ? spread.labelsByLocale.en : undefined,
      labels_cn: layoutType === "flex" ? spread.labelsByLocale["zh-CN"] : undefined,
      cardPools: spread.cardPools, cardSize: cardSizeForCount(spread.cardCount),
      icon: makeSpreadIcon({ id, layout: spread.layout, cardCount: spread.cardCount }),
      interpretationInstruction_en: spread.interpretationInstructions.en,
      interpretationInstruction_cn: spread.interpretationInstructions["zh-CN"],
      defaultQuestions_en: spread.defaultQuestions?.en,
      defaultQuestions_cn: spread.defaultQuestions?.["zh-CN"],
    };
  }
}

const localizedPositions = (positions: SpreadPositionLayout[] | undefined, labels: string[] | undefined) =>
  positions && labels ? positions.map((position, index) => ({ ...position, label: labels[index] ?? "" })) : undefined;

export const getLocalizedSpread = (id: SpreadType, locale: Locale): SpreadDefinition => {
  const spread = SPREADS[id];
  if (!spread) throw new Error(`Spread ${id} is not available from the tarot API.`);
  const isCn = locale === "zh-CN";
  const positionLabels = isCn ? spread.positionLabels_cn : spread.positionLabels_en;
  return {
    id: spread.id, name: isCn ? spread.name_cn : spread.name_en,
    description: isCn ? spread.description_cn : spread.description_en, cardCount: spread.cardCount,
    layoutType: spread.layoutType, positions: localizedPositions(spread.positions, positionLabels),
    labels: isCn ? spread.labels_cn : spread.labels_en, cardPools: spread.cardPools,
    cardSize: spread.cardSize, icon: spread.icon,
    interpretationInstruction: isCn ? spread.interpretationInstruction_cn : spread.interpretationInstruction_en,
    defaultQuestions: isCn ? spread.defaultQuestions_cn : spread.defaultQuestions_en,
  };
};
