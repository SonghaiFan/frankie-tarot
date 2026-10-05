import { CardFaceStyle } from "@/features/tarot/types";

export interface CardFaceStyleOption {
  id: CardFaceStyle;
  nameKey: string;
  descriptionKey: string;
  previewImage: string;
}

export const CARD_FACE_STYLES: CardFaceStyleOption[] = [
  {
    id: "dreamy",
    nameKey: "deck.cardFaces.dreamy.name",
    descriptionKey: "deck.cardFaces.dreamy.description",
    previewImage: "maj00.png",
  },
  {
    id: "redraw",
    nameKey: "deck.cardFaces.redraw.name",
    descriptionKey: "deck.cardFaces.redraw.description",
    previewImage: "maj00.png",
  },
  {
    id: "original",
    nameKey: "deck.cardFaces.original.name",
    descriptionKey: "deck.cardFaces.original.description",
    previewImage: "maj00.png",
  },
];

export const DEFAULT_CARD_FACE_STYLE: CardFaceStyle = "redraw";

/**
 * 1909 original Wikimedia scans include a physical paper border.
 * This negative inset/margin crops off the scanned paper margin so the inner black frame
 * aligns seamlessly with the card container, eliminating double borders and ensuring pixel-perfect diff alignment.
 */
export const ORIGINAL_CARD_INSET_CLASS =
  "-inset-x-[5.5%] inset-y-[0.25%] h-[calc(100%-0.5%)] w-[calc(100%+11%)] max-w-none";
