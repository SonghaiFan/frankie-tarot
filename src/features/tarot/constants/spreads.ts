import type { ReactNode } from "react";
import layoutData from "@/features/tarot/data/spread-layouts.json";
import type { SpreadType, CardPoolType, Locale } from "@/features/tarot/types";
import { SpreadPosition, SpreadPositionLayout, makeSpreadIcon } from "@/features/tarot/components/icons/SpreadIcons";

export type { SpreadPosition, SpreadPositionLayout };
type LayoutRecord = { type: "flex" | "absolute"; offset?: { x:number;y:number }; positions?: SpreadPositionLayout[] | null; cardSize: { mobile:string;desktop:string } };
const layouts = layoutData.layouts as Record<string, LayoutRecord>;

export interface SpreadData {
  id: SpreadType;
  name_en: string; name_cn: string; description_en: string; description_cn: string;
  cardCount: number; layoutType: "flex" | "absolute"; positions?: SpreadPositionLayout[];
  layoutOffset?: {x:number;y:number}; positionLabels_en?: string[]; positionLabels_cn?: string[];
  labels_en?: string[]; labels_cn?: string[]; cardPools?: CardPoolType[];
  cardSize: {mobile:string;desktop:string}; icon: (isActive:boolean)=>ReactNode;
  interpretationInstruction_en: string; interpretationInstruction_cn: string;
  defaultQuestions_en?: string[]; defaultQuestions_cn?: string[];
}
export interface SpreadDefinition {
  id: SpreadType; name:string; description:string; cardCount:number; layoutType:"flex"|"absolute";
  positions?:SpreadPosition[]; layoutOffset?:{x:number;y:number}; labels?:string[]; cardPools?:CardPoolType[];
  cardSize:{mobile:string;desktop:string}; icon:(isActive:boolean)=>ReactNode;
  interpretationInstruction:string; defaultQuestions?:string[];
}
export interface ApiSpread {
  id:string; names:{en:string;"zh-CN":string}; descriptions:{en:string;"zh-CN":string};
  cardCount:number; labelsByLocale:{en:string[];"zh-CN":string[]};
  cardPools:CardPoolType[]; interpretationInstructions:{en:string;"zh-CN":string};
  defaultQuestions?:{en?:string[];"zh-CN"?:string[]};
}

export const SPREADS = {} as Record<SpreadType, SpreadData>;

export function registerRemoteSpreads(remoteSpreads: ApiSpread[]) {
  for (const key of Object.keys(SPREADS)) delete (SPREADS as any)[key];
  for (const spread of remoteSpreads) {
    const layout = layouts[spread.id];
    if (!layout || !spread.labelsByLocale?.en || !spread.labelsByLocale?.["zh-CN"]) continue;
    const id = spread.id as SpreadType;
    SPREADS[id] = {
      id, name_en:spread.names.en, name_cn:spread.names["zh-CN"],
      description_en:spread.descriptions.en, description_cn:spread.descriptions["zh-CN"],
      cardCount:spread.cardCount, layoutType:layout.type, positions:layout.positions ?? undefined,
      layoutOffset:layout.offset, positionLabels_en:layout.type === "absolute" ? spread.labelsByLocale.en : undefined,
      positionLabels_cn:layout.type === "absolute" ? spread.labelsByLocale["zh-CN"] : undefined,
      labels_en:layout.type === "flex" ? spread.labelsByLocale.en : undefined,
      labels_cn:layout.type === "flex" ? spread.labelsByLocale["zh-CN"] : undefined,
      cardPools:spread.cardPools, cardSize:layout.cardSize,
      icon:makeSpreadIcon({id,layout:{type:layout.type,positions:layout.positions},cardCount:spread.cardCount}),
      interpretationInstruction_en:spread.interpretationInstructions.en,
      interpretationInstruction_cn:spread.interpretationInstructions["zh-CN"],
      defaultQuestions_en:spread.defaultQuestions?.en,
      defaultQuestions_cn:spread.defaultQuestions?.["zh-CN"],
    };
  }
}

const localizedPositions = (positions: SpreadPositionLayout[]|undefined, labels:string[]|undefined) =>
  positions && labels ? positions.map((position,index)=>({...position,label:labels[index]??""})) : undefined;

export const getLocalizedSpread = (id:SpreadType, locale:Locale):SpreadDefinition => {
  const spread=SPREADS[id];
  if (!spread) throw new Error(`Spread ${id} is not available from the tarot API.`);
  const isCn=locale === "zh-CN";
  const positionLabels=isCn?spread.positionLabels_cn:spread.positionLabels_en;
  return {id:spread.id,name:isCn?spread.name_cn:spread.name_en,
    description:isCn?spread.description_cn:spread.description_en,cardCount:spread.cardCount,
    layoutType:spread.layoutType,positions:localizedPositions(spread.positions,positionLabels),
    layoutOffset:spread.layoutOffset,labels:isCn?spread.labels_cn:spread.labels_en,
    cardPools:spread.cardPools,cardSize:spread.cardSize,icon:spread.icon,
    interpretationInstruction:isCn?spread.interpretationInstruction_cn:spread.interpretationInstruction_en,
    defaultQuestions:isCn?spread.defaultQuestions_cn:spread.defaultQuestions_en};
};
