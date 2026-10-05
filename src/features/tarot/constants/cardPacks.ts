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
  badge?: string;
  accentBorder: string;
  glowColor: string;
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
    accentBorder: "border-amber-500/60 group-hover:border-amber-400",
    glowColor: "from-amber-500/20 via-orange-500/10 to-blue-500/20",
  },
  {
    id: "redraw",
    nameKey: "deck.packs.redraw.name",
    descriptionKey: "deck.packs.redraw.description",
    tagKey: "deck.packs.tags.default",
    cardFaceStyle: "redraw",
    cardBackId: "celestial-compass",
    previewCard: "maj00.png",
    accentBorder: "border-sky-500/60 group-hover:border-sky-400",
    glowColor: "from-blue-500/20 via-indigo-500/10 to-neutral-700/20",
  },
  {
    id: "original",
    nameKey: "deck.packs.original.name",
    descriptionKey: "deck.packs.original.description",
    tagKey: "deck.packs.tags.classic",
    cardFaceStyle: "original",
    cardBackId: "thorn-bloom",
    previewCard: "maj00.png",
    accentBorder: "border-emerald-500/60 group-hover:border-emerald-400",
    glowColor: "from-emerald-500/20 via-amber-500/10 to-neutral-800/20",
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
