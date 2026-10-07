import groundTruth from "@/features/tarot/data/ground-truth.json";

export interface CardDimensionConfig {
  name: string;
  widthCm: number;
  heightCm: number;
  widthMm: number;
  heightMm: number;
  aspectRatio: string;
  heightToWidthRatio: number;
  tailwindAspect: string;
}

type GroundTruthCardDimensions = {
  standard: CardDimensionConfig;
};

const dimensionsData = (groundTruth as { cardDimensions?: GroundTruthCardDimensions })
  ?.cardDimensions?.standard;

/**
 * Standard classic tarot card dimensions (7 × 12 cm, Rider-Waite standard).
 * Width:Height = 7:12.
 * Height-to-width ratio: 12 / 7 ≈ 1.7142857.
 */
export const TAROT_CARD_DIMENSIONS = {
  name: dimensionsData?.name ?? "Classic Tarot (Rider-Waite)",
  widthCm: dimensionsData?.widthCm ?? 7,
  heightCm: dimensionsData?.heightCm ?? 12,
  widthMm: dimensionsData?.widthMm ?? 70,
  heightMm: dimensionsData?.heightMm ?? 120,
  aspectRatioStr: dimensionsData?.aspectRatio ?? "7/12",
  aspectClass: dimensionsData?.tailwindAspect ?? "aspect-[7/12]",
  // Height-to-width numerical multiplier (12 / 7 ≈ 1.7142857) used for spread layout calculations
  aspectRatio: dimensionsData?.heightToWidthRatio ?? 12 / 7,
} as const;

export const CARD_ASPECT_RATIO = TAROT_CARD_DIMENSIONS.aspectRatio;
export const CARD_ASPECT_CLASS = TAROT_CARD_DIMENSIONS.aspectClass;
/** Shared silhouette, matching the landing card at every rendered size. */
export const CARD_CORNER_CLASS = "rounded-[7%/4.1%]";
export const CARD_BORDER_RADIUS = "7% / 4.1%";
export const CARD_INNER_CORNER_CLASS = "rounded-[5.2%/3.1%]";
