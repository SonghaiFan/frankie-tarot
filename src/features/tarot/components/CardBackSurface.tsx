import { useCardFrame } from "../hooks/useCardFrame";
import { CARD_CORNER_CLASS } from "@/features/tarot/constants/cardDimensions";
import React, { useEffect, useRef } from "react";
import { CardBackId, getCardBackImageUrl } from "@/features/tarot/constants/cardBacks";
import { useCardBackAppearance } from "@/features/tarot/hooks/useCardBackAppearance";
import { registerAuraWindow } from "@/features/tarot/services/sharedAuraField";

interface CardBackSurfaceProps {
  cardBackId: CardBackId;
  className?: string;
  patternOpacity?: string;
}

const CardBackSurface: React.FC<CardBackSurfaceProps> = ({
  cardBackId,
  className = "",
  patternOpacity = "opacity-10",
}) => {
  const { mode } = useCardBackAppearance();
  const frame = useCardFrame(cardBackId);
  const auraRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = auraRef.current;
    return canvas ? registerAuraWindow(canvas) : undefined;
  }, [registerAuraWindow]);

  return (
    <div
      style={{ padding: frame.padding }}
      aria-hidden="true"
      className={`relative h-full w-full overflow-hidden ${CARD_CORNER_CLASS} bg-white ${className}`}
    >
      <div className="relative h-full w-full overflow-hidden bg-neutral-950" style={{ borderRadius: frame.innerRadius }}>
        <canvas ref={auraRef} className="absolute inset-0 h-full w-full" />
        <img
          src={getCardBackImageUrl(cardBackId)}
          alt=""
          draggable={false}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${patternOpacity}`}
        />
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[15%] w-[15%] -translate-x-1/2 -translate-y-1/2 fill-white/80 drop-shadow-[0_1px_8px_rgba(255,255,255,0.5)]"
        >
          <path d="M50 0C54 34 66 46 100 50 66 54 54 66 50 100 46 66 34 54 0 50 34 46 46 34 50 0Z" />
        </svg>
        {mode === "gradient" && <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/[0.05] via-transparent to-black/25" />}
      </div>
    </div>
  );
};

export default CardBackSurface;
