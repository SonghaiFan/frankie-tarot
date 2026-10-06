import { CardFaceStyle } from "@/features/tarot/types";
import { CardBackId } from "./cardBacks";

export interface CardPack {
  id: string;
  nameKey: string;
  descriptionKey: string;
  tagKey?: string;
  cardFaceStyle: CardFaceStyle;
  cardBackId: CardBackId;
  previewCard: string;
}

export const CARD_PACKS: CardPack[] = [
  {
    id: "dreamy",
    nameKey: "deck.packs.dreamy.name",
    descriptionKey: "deck.packs.dreamy.description",
    tagKey: "deck.packs.tags.new",
    cardFaceStyle: "dreamy",
    cardBackId: "eclipse-nocturne",
    previewCard: "maj00.png",
  },
  {
    id: "redraw",
    nameKey: "deck.packs.redraw.name",
    descriptionKey: "deck.packs.redraw.description",
    tagKey: "deck.packs.tags.default",
    cardFaceStyle: "redraw",
    cardBackId: "celestial-compass",
    previewCard: "maj00.png",
  },
  {
    id: "original",
    nameKey: "deck.packs.original.name",
    descriptionKey: "deck.packs.original.description",
    tagKey: "deck.packs.tags.classic",
    cardFaceStyle: "original",
    cardBackId: "thorn-bloom",
    previewCard: "maj00.png",
  },
];

export const DEFAULT_CARD_PACK_ID = "dreamy";

export const getCardPack = (id: string): CardPack =>
  CARD_PACKS.find((pack) => pack.id === id) ?? CARD_PACKS[0];

export const findPackByCombination = (
  faceStyle: CardFaceStyle,
  backId: CardBackId
): CardPack | undefined =>
  CARD_PACKS.find(
    (pack) => pack.cardFaceStyle === faceStyle && pack.cardBackId === backId
  );
