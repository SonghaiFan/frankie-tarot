import React from "react";
import { CardBackId, getCardBackImageUrl } from "@/features/tarot/constants/cardBacks";

interface CardBackSurfaceProps {
  cardBackId: CardBackId;
  className?: string;
  patternOpacity?: string;
}

const CardBackSurface: React.FC<CardBackSurfaceProps> = ({
  cardBackId,
  className = "",
  patternOpacity = "opacity-25",
}) => (
  <div
    aria-hidden="true"
    className={`relative h-full w-full overflow-hidden bg-neutral-950 ${className}`}
  >
    <img
      src={getCardBackImageUrl(cardBackId)}
      alt=""
      draggable={false}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${patternOpacity}`}
    />
    <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/[0.05] via-transparent to-black/30" />
  </div>
);

export default CardBackSurface;
