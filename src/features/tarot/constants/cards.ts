import { TarotCard, CardFaceStyle } from "@/features/tarot/types";

const remoteImages = new Map<string, { redraw: string; dreamy: string; original: string }>();
/** Keep API-provided image variants addressable by opaque card ID. */
export function registerRemoteCards(cards: TarotCard[]) {
  remoteImages.clear();
  for (const card of cards) {
    if (card.imageUrls) remoteImages.set(card.image.replace(/\.[^/.]+$/, ""), card.imageUrls);
  }
}

export const getCardImageUrl = (imageOrKey: string, style: CardFaceStyle = "redraw"): string => {
  if (!imageOrKey) return "";
  if (/^https?:\/\//.test(imageOrKey) || imageOrKey.startsWith("/")) return imageOrKey;
  const key = imageOrKey.replace(/\.[^/.]+$/, "");
  const imageSet = remoteImages.get(key);
  if (imageSet && (style === "redraw" || style === "dreamy" || style === "original")) return imageSet[style];
  return "";
};

export { CARD_ASPECT_RATIO, CARD_ASPECT_CLASS } from "./cardDimensions";
