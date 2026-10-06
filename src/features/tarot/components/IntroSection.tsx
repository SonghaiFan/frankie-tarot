import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useTranslation } from "react-i18next";
import { CardBackId } from "@/features/tarot/constants/cardBacks";
import { CARD_ASPECT_CLASS } from "@/features/tarot/constants/cards";
import { SILKY_EASE } from "@/shared/constants/ui";
import AuraLogoCard, { AuraPackFlap } from "./AuraLogoCard";
import CardBackSurface from "./CardBackSurface";

interface IntroSectionProps {
  cardBackId: CardBackId;
  /** Runs inside the click itself, for work browsers only allow during a gesture (audio). */
  onStart: () => void;
  /** Runs once the opening animation has played. */
  onEnter: () => void;
}

const MAX_TILT = 9;
const tiltSpring = { stiffness: 120, damping: 18, mass: 0.8 };

// Cards rising out of the open box, each flung to its own side.
const FLIGHTS = [
  { x: -170, rotate: -20 },
  { x: -75, rotate: -9 },
  { x: 10, rotate: 3 },
  { x: 90, rotate: 11 },
  { x: 180, rotate: 22 },
];
// After the flap is up, the deck first peeks out of the box, then flies.
const CARD_DELAY = 0.4;
const CARD_STAGGER = 0.09;
const CARD_FLIGHT = 1;
const BOX_DROP_DELAY = 0.85;
const BOX_DROP = 0.8;
const ENTER_AFTER_MS = 1700;

/** The home page is only the card pack: touching it opens the box and starts the ritual. */
const IntroSection: React.FC<IntroSectionProps> = ({ cardBackId, onStart, onEnter }) => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const tiltX = useSpring(useMotionValue(0), tiltSpring);
  const tiltY = useSpring(useMotionValue(0), tiltSpring);
  const packRef = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState<{ packHeight: number; viewport: number }>();

  useEffect(() => {
    if (prefersReducedMotion || opening) return;
    const handlePointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      tiltY.set(((event.clientX / window.innerWidth) * 2 - 1) * MAX_TILT);
      tiltX.set(-((event.clientY / window.innerHeight) * 2 - 1) * MAX_TILT);
    };
    const reset = () => { tiltX.set(0); tiltY.set(0); };
    window.addEventListener("pointermove", handlePointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", handlePointer);
      document.documentElement.removeEventListener("pointerleave", reset);
    };
  }, [prefersReducedMotion, opening, tiltX, tiltY]);

  // Latest onEnter without restarting the timer when the parent re-renders.
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(() => onEnterRef.current(), ENTER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [opening]);

  const handleOpen = () => {
    if (opening) return;
    onStart();
    if (prefersReducedMotion) {
      onEnter();
      return;
    }
    tiltX.set(0);
    tiltY.set(0);
    setOpening({ packHeight: packRef.current?.offsetHeight ?? 160, viewport: window.innerHeight });
  };

  // The flap and the box fall away together once the deck is out.
  const boxDrop = opening ? { y: opening.viewport * 0.75, rotate: 5, opacity: [1, 1, 0] } : { y: 0, rotate: 0, opacity: 1 };
  const boxDropTransition = { delay: BOX_DROP_DELAY, duration: BOX_DROP, ease: [0.55, 0, 0.8, 0.3] as const, opacity: { delay: BOX_DROP_DELAY, duration: BOX_DROP, times: [0, 0.6, 1] } };

  return (
    <motion.div
    key="intro"
    className="min-h-[100dvh] w-full flex items-center justify-center px-4 pt-[var(--safe-top)] pb-[var(--safe-bottom)] z-20"
    exit={{
      opacity: 0,
      filter: "blur(20px)",
      transition: { duration: 1 },
    }}
  >
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1.6, ease: SILKY_EASE }}
      className="group relative [perspective:1200px]"
    >
      <motion.div
        animate={prefersReducedMotion || opening ? { y: 0 } : { y: [0, -10, 0] }}
        transition={opening ? { duration: 0.3 } : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        <motion.button
          type="button"
          onClick={handleOpen}
          disabled={!!opening}
          aria-label={`Frank Tarot · ${t("intro.enter")}`}
          title={t("intro.enter")}
          style={{ rotateX: tiltX, rotateY: tiltY }}
          whileHover={prefersReducedMotion || opening ? undefined : { scale: 1.035 }}
          whileTap={opening ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative block cursor-pointer rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:ring-offset-8 focus-visible:ring-offset-transparent disabled:cursor-default"
        >
          {/* Back to front, as in a real tuck box: flap, deck, box. */}
          <div ref={packRef} className="relative">
            <motion.div className="absolute inset-0" animate={boxDrop} transition={boxDropTransition}>
              <AuraPackFlap open={!!opening} />
            </motion.div>

            {opening && FLIGHTS.map(({ x, rotate }, index) => (
              <motion.div
                key={index}
                aria-hidden="true"
                className={`pointer-events-none absolute bottom-[1.5%] left-[2%] w-[86%] ${CARD_ASPECT_CLASS}`}
                initial={{ y: 0, x: 0, rotate: 0 }}
                animate={{
                  y: [0, -opening.packHeight * 0.3, -opening.packHeight * 0.95, -(opening.viewport * 0.6 + opening.packHeight * 2)],
                  x: [0, 0, x * 0.15, x],
                  rotate: [0, 0, rotate * 0.3, rotate],
                }}
                transition={{ delay: CARD_DELAY + index * CARD_STAGGER, duration: CARD_FLIGHT, times: [0, 0.22, 0.45, 1], ease: [0.35, 0, 0.2, 1] }}
              >
                <CardBackSurface cardBackId={cardBackId} />
              </motion.div>
            ))}

            <motion.div className="relative" animate={boxDrop} transition={boxDropTransition}>
              <AuraLogoCard open={!!opening} className="h-[min(24dvh,218px)] min-h-[145px]" />
            </motion.div>
          </div>
        </motion.button>
      </motion.div>

      {/* Shown only while the pack is hovered or focused. */}
      <p
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-full mt-12 -translate-x-1/2 whitespace-nowrap text-[11px] tracking-[0.36em] text-white opacity-0 transition-opacity duration-700 ${opening ? "" : "group-hover:opacity-60 group-has-[:focus-visible]:opacity-60"}`}
      >
        {t("intro.hint")}
      </p>
    </motion.div>
  </motion.div>
  );
};

export default IntroSection;
