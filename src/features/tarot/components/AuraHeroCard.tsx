import React, { useEffect, useRef } from "react";
import { CARD_ASPECT_CLASS } from "@/features/tarot/constants/cards";
import { registerAuraWindow } from "@/features/tarot/services/sharedAuraField";

const SPARKLE = "M50 0C54 34 66 46 100 50 66 54 54 66 50 100 46 66 34 54 0 50 34 46 46 34 50 0Z";

/** Deck-card height the aura is sized to, so the hero keeps the deck's finer flow. */
export const HERO_AURA_SCALE = 150;

/** The home page's single card: the deck's aura behind glass, edged in warm light. */
interface AuraHeroCardProps {
  className?: string;
  /** Receives the painted face canvas, e.g. for the water to reflect. */
  faceCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

const AuraHeroCard: React.FC<AuraHeroCardProps> = ({ className = "", faceCanvasRef }) => {
  const ownFaceRef = useRef<HTMLCanvasElement>(null);
  const faceRef = faceCanvasRef ?? ownFaceRef;
  const glowRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cleanups = [faceRef, glowRef].map(({ current }) => current && registerAuraWindow(current, HERO_AURA_SCALE));
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, []);

  return (
    <div aria-hidden="true" className={`relative ${CARD_ASPECT_CLASS} ${className}`}>
      {/* The card's own colour bleeding into the dark around it. A canvas does not
          stretch between insets, so it is sized explicitly. */}
      <canvas ref={glowRef} className="absolute left-[10%] top-[10%] h-[80%] w-[80%] rounded-[8%] opacity-35 blur-[36px]" />
      <div className="absolute inset-0 overflow-hidden rounded-[7%/4.1%] border-[1.5px] border-[rgba(255,214,184,0.8)] bg-neutral-950 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_28px_rgba(255,190,150,0.18),0_30px_80px_-20px_rgba(0,0,0,0.9)]">
        <canvas ref={faceRef} className="absolute inset-0 h-full w-full" />
        {/* Glass: a soft sheen from the top-left and a hairline inner bevel. */}
        <div className="absolute inset-0 bg-linear-to-br from-white/[0.14] via-transparent to-black/20" />
        <div className="absolute inset-[1.2%] rounded-[6.4%/3.7%] border border-white/[0.12]" />
        <svg viewBox="0 0 100 100" className="absolute left-[11%] top-[8%] w-[22%] fill-white drop-shadow-[0_0_10px_rgba(255,255,255,0.75)]">
          <path d={SPARKLE} />
        </svg>
      </div>
    </div>
  );
};

export default AuraHeroCard;
