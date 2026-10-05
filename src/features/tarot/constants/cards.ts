import groundTruth from "@/features/tarot/data/ground-truth.json";
import cardImagesManifest from "@/features/tarot/data/card-images.json";
import { TarotCard, CardPoolType, CardFaceStyle } from "@/features/tarot/types";

const baseUrl =
  typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
    ? import.meta.env.BASE_URL
    : "/";
const LOCAL_CDN = `${baseUrl}images/cards/`;
const LOCAL_DREAMY_CDN = `${baseUrl}images/cards_dreamy/`;
const LOCAL_ORIGINAL_CDN = `${baseUrl}images/cards_rws_original/`;
const cardImageMap = cardImagesManifest as Record<string, string>;

type GroundTruthCardRecord = {
  id: string;
  numericId: number;
  image: string;
  name: {
    en: string;
    "zh-CN": string;
  };
  keywords: {
    en: string[];
    "zh-CN": string[];
  };
  description: {
    en?: string;
    "zh-CN"?: string;
  };
  meanings: {
    upright: {
      en?: string;
      "zh-CN"?: string;
    };
    reversed: {
      en?: string;
      "zh-CN"?: string;
    };
  };
};

type GroundTruthCards = {
  allIds: string[];
  byId: Record<string, GroundTruthCardRecord>;
  groups: {
    majorArcana: string[];
    minorArcana: string[];
    fullDeck: string[];
  };
};

const cardsData = (groundTruth as { cards: GroundTruthCards }).cards;

const toTarotCard = (card: GroundTruthCardRecord): TarotCard => ({
  id: card.numericId,
  nameEn: card.name.en,
  nameCn: card.name["zh-CN"],
  descriptionEn: card.description.en,
  descriptionCn: card.description["zh-CN"],
  keywordsEn: card.keywords.en,
  keywords: card.keywords["zh-CN"],
  image: card.image,
  positiveEn: card.meanings.upright.en,
  positive: card.meanings.upright["zh-CN"],
  negativeEn: card.meanings.reversed.en,
  negative: card.meanings.reversed["zh-CN"],
});

const getCardsByIds = (ids: string[]) =>
  ids.map((id) => toTarotCard(cardsData.byId[id]));

export const MAJOR_ARCANA: TarotCard[] = getCardsByIds(cardsData.groups.majorArcana);
export const MINOR_ARCANA: TarotCard[] = getCardsByIds(cardsData.groups.minorArcana);
export const FULL_DECK: TarotCard[] = getCardsByIds(cardsData.groups.fullDeck);

export const getCardImageUrl = (
  imageOrKey: string,
  style: CardFaceStyle = "redraw"
): string => {
  if (!imageOrKey) return "";
  if (
    imageOrKey.startsWith("http://") ||
    imageOrKey.startsWith("https://") ||
    imageOrKey.startsWith("/")
  ) {
    return imageOrKey;
  }
  // Strip any existing file extension (e.g. "maj00.jpg" or "maj00.png" -> "maj00")
  const key = imageOrKey.replace(/\.[^/.]+$/, "");
  let baseCdn = LOCAL_CDN;
  if (style === "original") {
    baseCdn = LOCAL_ORIGINAL_CDN;
  } else if (style === "dreamy") {
    baseCdn = LOCAL_DREAMY_CDN;
  }
  return `${baseCdn}${key}.webp`;
};

export const STATIC_SCRIPTS = {
  WELCOME: "静心凝视深渊。当你的直觉苏醒时,进入命运之门。",
  ASK: "心中的疑惑,是通往真理的钥匙。告诉我,你为何而来？",
  SHUFFLE: "星辰正在归位,混乱中孕育着秩序。专注于你的问题。",
  PICK: "在流动的命运中,选择你的指引。",
  REVEAL: "这就是……命运的回响。",
};

export const getDeckForPool = (pool: CardPoolType): TarotCard[] => {
  const courtPrefixes = ["Page", "Knight", "Queen", "King"];
  const isCourt = (c: TarotCard) =>
    courtPrefixes.some((p) => c.nameEn.startsWith(p));

  switch (pool) {
    case "MAJOR":
      return MAJOR_ARCANA;
    case "MINOR_PIP":
      return MINOR_ARCANA.filter((c) => !isCourt(c));
    case "COURT":
      return MINOR_ARCANA.filter((c) => isCourt(c));
    case "SUIT_CUPS":
      return MINOR_ARCANA.filter((c) => c.nameEn.includes("Cups"));
    case "SUIT_PENTACLES":
      return MINOR_ARCANA.filter((c) => c.nameEn.includes("Pentacles"));
    case "SUIT_SWORDS":
      return MINOR_ARCANA.filter((c) => c.nameEn.includes("Swords"));
    case "SUIT_WANDS":
      return MINOR_ARCANA.filter((c) => c.nameEn.includes("Wands"));
    case "FULL":
    default:
      return FULL_DECK;
  }
};

export {
  TAROT_CARD_DIMENSIONS,
  CARD_ASPECT_RATIO,
  CARD_ASPECT_CLASS,
} from "./cardDimensions";
export type { CardDimensionConfig } from "./cardDimensions";
