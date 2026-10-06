import React, { useEffect, useRef } from "react";
import { motion } from "motion/react";
import FrankSignature from "@/app/components/FrankSignature";
import { CARD_ASPECT_RATIO } from "@/features/tarot/constants/cards";
import { registerAuraWindow } from "@/features/tarot/services/sharedAuraField";

const SPARKLE = "M50 0C54 34 66 46 100 50 66 54 54 66 50 100 46 66 34 54 0 50 34 46 46 34 50 0Z";

// Geometry follows public/favicon.svg — a 250-wide face at (40,70) with its black
// box extruded 24 units up and to the right — but the face is stretched to the
// deck's real card proportion (7:12) so the cards inside fit the box.
const FACE_W = 250;
const FACE_H = FACE_W * CARD_ASPECT_RATIO;
const DEPTH = 24;
const VIEW_W = FACE_W + DEPTH;
const VIEW_H = FACE_H + DEPTH;
const FACE_BOTTOM = 70 + FACE_H;
const pct = (value: number, total: number) => `${(value / total) * 100}%`;
// The painted face sits 2 units inside the frame stroke so no seam leaks past it.
const FACE = { left: pct(2, VIEW_W), top: pct(DEPTH + 2, VIEW_H), width: pct(FACE_W - 4, VIEW_W), height: pct(FACE_H - 4, VIEW_H) };
// Top and side faces of the box, where the aura is allowed to reflect.
const BOX_EDGES = `polygon(${[[0, DEPTH], [DEPTH, 0], [VIEW_W, 0], [VIEW_W, FACE_H], [FACE_W, VIEW_H], [FACE_W, DEPTH]]
  .map(([x, y]) => `${pct(x, VIEW_W)} ${pct(y, VIEW_H)}`).join(", ")})`;
// The closed lid is the box's top face. Like a tuck box it is hinged on the
// BACK edge (the top of this strip): opening folds it back and up into the flap.
const LID = { height: pct(DEPTH, VIEW_H), clipPath: `polygon(0 100%, ${pct(DEPTH, VIEW_W)} 0, 100% 0, ${pct(FACE_W, VIEW_W)} 100%)` };
// The opened lid standing up behind the cards: a rounded tuck flap on the back edge.
const FLAP_H = 110;
const FLAP = { left: pct(DEPTH, VIEW_W), width: pct(FACE_W, VIEW_W), height: pct(FLAP_H, VIEW_H) };
const LID_FOLD = { duration: 0.18, ease: [0.5, 0, 1, 1] as const };
const FLAP_RISE = { delay: 0.14, duration: 0.34, ease: [0, 0, 0.2, 1.25] as const };
const VIEW_BOX = `40 46 ${VIEW_W} ${VIEW_H}`;

/** Deck-card height the hero's aura is sized to, so it keeps the deck's finer flow. */
const AURA_SCALE_REFERENCE = 150;

interface AuraLogoCardProps {
  className?: string;
  /** Flips the lid back to reveal the box's dark inside. */
  open?: boolean;
}

/** The app icon as a card box, its face painted by the same aura as the deck's card backs. */
const AuraLogoCard: React.FC<AuraLogoCardProps> = ({ className = "", open = false }) => {
  const faceRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const edgeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cleanups = [faceRef, glowRef, edgeRef].map(({ current }) => current && registerAuraWindow(current, AURA_SCALE_REFERENCE));
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, []);

  return (
    <div aria-hidden="true" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }} className={`relative [container-type:inline-size] [perspective:600px] ${className}`}>
      {/* Light spilling from the face onto the void around it. */}
      <canvas ref={glowRef} className="absolute opacity-50 blur-[56px] saturate-150" style={FACE} />

      <svg viewBox={VIEW_BOX} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="aura-logo-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2e2c29" />
            <stop offset="1" stopColor="#0b0a0a" />
          </linearGradient>
        </defs>
        <rect x="40" y="70" width={FACE_W} height={FACE_H} fill="#1c1b1a" />
        {/* The opening under the lid. */}
        <polygon points="40,70 64,46 314,46 290,70" fill="#050505" />
        <polygon points={`290,70 314,46 314,${FACE_BOTTOM - DEPTH} 290,${FACE_BOTTOM}`} fill="url(#aura-logo-side)" />
      </svg>

      <motion.div
        className="absolute inset-x-0 top-0 origin-top bg-linear-to-r from-[#57524c] to-[#2b2927]"
        style={LID}
        initial={false}
        animate={{ scaleY: open ? 0 : 1 }}
        transition={LID_FOLD}
      />

      {/* The face's colour caught faintly on the box's top and side. */}
      <canvas ref={edgeRef} className={`absolute inset-0 h-full w-full mix-blend-screen blur-[3px] transition-opacity duration-300 ${open ? "opacity-0" : "opacity-30"}`} style={{ clipPath: BOX_EDGES }} />

      <div className="absolute overflow-hidden bg-neutral-950" style={FACE}>
        <canvas ref={faceRef} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-linear-to-br from-white/[0.12] via-transparent to-black/25" />
        <div className="aura-pack-shine absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-transparent via-white/30 to-transparent mix-blend-overlay" />
        {/* The pack's label: the wordmark printed low on the face. */}
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-linear-to-t from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-[9%] flex flex-col items-center gap-[2.2cqw] text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.35)]">
          <FrankSignature className="h-[13cqw] w-auto" />
          <span className="font-cinzel text-[max(6.2cqw,9px)] font-bold leading-none tracking-[0.42em] pl-[0.42em]">TAROT</span>
        </div>
      </div>

      <svg viewBox={VIEW_BOX} className="pointer-events-none absolute inset-0 h-full w-full">
        <rect x="44" y="74" width={FACE_W - 8} height={FACE_H - 8} fill="none" stroke="#1c1b1a" strokeWidth="8" />
        <rect x="48.5" y="78.5" width={FACE_W - 17} height={FACE_H - 17} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <polyline points="40,70 64,46 314,46" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" className={`transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
        <line x1="290" y1="70" x2="314" y2="46" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        <path transform="translate(72 104) scale(0.52)" d={SPARKLE} fill="#fff" className="drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
      </svg>
    </div>
  );
};

/**
 * The tuck flap of the opened box, printed with the same aura as the face. Render
 * it at the same size as AuraLogoCard and BEHIND the cards, so the cards rise in
 * front of it as in a real card box.
 */
export const AuraPackFlap: React.FC<{ open: boolean }> = ({ open }) => {
  const auraRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = auraRef.current;
    return canvas ? registerAuraWindow(canvas, AURA_SCALE_REFERENCE) : undefined;
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute bottom-full origin-bottom overflow-hidden rounded-t-[50%_80%] bg-[#1c1b1a] p-[2.5%] pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
        style={FLAP}
        initial={false}
        animate={{ scaleY: open ? 1 : 0 }}
        transition={open ? FLAP_RISE : LID_FOLD}
      >
        <div className="relative h-full w-full overflow-hidden rounded-t-[50%_80%] bg-neutral-950">
          <canvas ref={auraRef} className="absolute inset-0 h-full w-full" />
          {/* Shaded toward the hinge, where it folds into the box. */}
          <div className="absolute inset-0 bg-linear-to-b from-white/[0.08] via-black/20 to-black/60" />
        </div>
      </motion.div>
    </div>
  );
};

export default AuraLogoCard;
