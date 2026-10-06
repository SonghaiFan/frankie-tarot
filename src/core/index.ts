import { SpreadType, PickedCard, Locale, TarotCard } from "@/features/tarot/types";
import { drawCards, getSpreadDefinition, listAvailableSpreads } from "./tarotEngine";
import {
  buildTarotReadingPrompt,
  buildTarotFollowUpPrompt,
  TarotReadingPromptOptions,
  TarotFollowUpPromptOptions,
} from "./promptBuilder";

export interface TarotRequest {
  /** 问卜者的问题 */
  question: string;
  /** 指定牌阵 ID，若传入 "AUTO" 或为空则回退为单张牌（SINGLE） */
  spread?: SpreadType | "AUTO";
  /** 语言偏好，默认 "zh-CN" */
  locale?: Locale;
  /** 自定义卡牌（若需要外部指定抽牌结果，而非内部随机抽牌） */
  customCards?: PickedCard[];
  /** 逆位概率 (0.0 ~ 1.0)，默认 0.4 */
  reversedProbability?: number;
}

export interface TarotPositionCard {
  positionIndex: number;
  positionLabel: string;
  card: PickedCard;
}

export interface TarotResponse {
  /** 问卜者的问题 */
  question: string;
  /** 语言 */
  locale: Locale;
  /** 牌阵元信息 */
  spread: {
    id: SpreadType;
    name: string;
    description: string;
    cardCount: number;
  };
  /** 抽取的卡牌及位置信息 */
  cards: TarotPositionCard[];
  /** 组装的提示词 */
  prompts: {
    /** 喂给外部大模型（如 ChatGPT 对话）的完整解读 Prompt */
    readingPrompt: string;
  };
}

/**
 * 端到端塔罗抽牌流水线：确定牌阵 → 抽牌 → 组装解读 Prompt。
 * 本项目不内置大模型调用；解读交给外部（ChatGPT 对话、DSH agent 等）。
 */
export async function runTarotPipeline(options: TarotRequest): Promise<TarotResponse> {
  const {
    question = "",
    locale = "zh-CN",
    reversedProbability = 0.4,
  } = options;

  // 1. 确定牌阵（无内置模型时，AUTO 回退为 SINGLE）
  const targetSpread: SpreadType =
    options.spread && options.spread !== "AUTO" ? options.spread : "SINGLE";

  // 2. 抽牌或使用指定卡牌
  const pickedCards: PickedCard[] =
    options.customCards && options.customCards.length > 0
      ? options.customCards
      : drawCards(targetSpread, { reversedProbability });

  const spreadConfig = getSpreadDefinition(targetSpread, locale);

  const cardsWithPositions: TarotPositionCard[] = pickedCards.map((card, idx) => {
    const positionLabel =
      spreadConfig.layoutType === "absolute"
        ? spreadConfig.positions?.[idx]?.label || (locale === "en" ? `Position ${idx + 1}` : `位置 ${idx + 1}`)
        : spreadConfig.labels?.[idx] || (locale === "en" ? `Position ${idx + 1}` : `位置 ${idx + 1}`);

    return {
      positionIndex: idx + 1,
      positionLabel,
      card,
    };
  });

  // 3. 组装解读 Prompt
  const readingPrompt = buildTarotReadingPrompt({
    cards: pickedCards,
    spread: targetSpread,
    question,
    locale,
  });

  return {
    question,
    locale,
    spread: {
      id: targetSpread,
      name: spreadConfig.name,
      description: spreadConfig.description,
      cardCount: spreadConfig.cardCount,
    },
    cards: cardsWithPositions,
    prompts: {
      readingPrompt,
    },
  };
}

// 导出所有核心子模块
export {
  drawCards,
  getSpreadDefinition,
  listAvailableSpreads,
  buildTarotReadingPrompt,
  buildTarotFollowUpPrompt,
};

export type {
  SpreadType,
  PickedCard,
  TarotCard,
  Locale,
  TarotReadingPromptOptions,
  TarotFollowUpPromptOptions,
};
