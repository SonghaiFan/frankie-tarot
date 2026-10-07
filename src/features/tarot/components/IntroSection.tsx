import React, { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTime,
  useTransform,
} from "motion/react";
import FrankSignature from "@/app/components/FrankSignature";
import { useTranslation } from "react-i18next";
import { SILKY_EASE } from "@/shared/constants/ui";
import AuraHeroCard from "./AuraHeroCard";
import { setReflectionSubject } from "../scene/reflection";

interface IntroSectionProps {
  quietEntrance?: boolean;
}

// The card's slow drift: a 10s bob and sway around a 15° lean.
const DRIFT_PERIOD_MS = 10_000;
const LEAN = 15;
const MAX_TILT = 8;
const tiltSpring = { stiffness: 110, damping: 18, mass: 0.8 };

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  // Words and buttons enter and leave with opacity only.
  exit: { opacity: 0, transition: { duration: 0.25, ease: "easeIn" as const } },
  transition: { delay, duration: 0.9, ease: SILKY_EASE },
});

/** The home page: one card floating over still water, and a single way in. */
const IntroSection: React.FC<IntroSectionProps> = ({
  quietEntrance = false,
}) => {
  const { t, i18n } = useTranslation();
  const entrance = (delay: number) => quietEntrance
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : fadeIn(delay);
  const isEnglish = i18n.language === "en";
  const prefersReducedMotion = useReducedMotion();
  const tiltX = useSpring(useMotionValue(0), tiltSpring);
  const tiltY = useSpring(useMotionValue(0), tiltSpring);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  // Driven by values (not keyframes) so the water can mirror the exact pose.
  const time = useTime();
  const phase = useTransform(time, (ms) =>
    prefersReducedMotion ? 0 : Math.sin((ms / DRIFT_PERIOD_MS) * Math.PI * 2),
  );
  const driftY = useTransform(phase, (p) => p * -6);
  const rotate = useTransform(phase, (p) => LEAN + p);

  // The sea mirrors this card while it floats over it.
  useEffect(() => {
    const canvas = faceCanvasRef.current;
    if (!canvas) return;
    setReflectionSubject({ canvas, rotate });
    return () => setReflectionSubject(null);
  }, [rotate]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const handlePointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      tiltY.set(((event.clientX / window.innerWidth) * 2 - 1) * MAX_TILT);
      tiltX.set(-((event.clientY / window.innerHeight) * 2 - 1) * MAX_TILT);
    };
    const reset = () => {
      tiltX.set(0);
      tiltY.set(0);
    };
    window.addEventListener("pointermove", handlePointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", handlePointer);
      document.documentElement.removeEventListener("pointerleave", reset);
    };
  }, [prefersReducedMotion, tiltX, tiltY]);

  return (
    // The sky, planet and sea behind this page are the shared SkyScene; on
    // leaving, the card fades out while the scene stays.
    <motion.div
      key="intro"
      className="fixed inset-0 z-20 overflow-hidden font-display text-white"
    >
      {/* The card, floating just above the water. */}
      {/* On phones the card sits midway between the title block (which ends
          5.5rem below its top) and the horizon at 58%, sized to fit that gap,
          so a notch or a host's bar above never pushes the title into it. */}
      <div className="absolute left-1/2 top-[calc((max(calc(var(--safe-top)+2.5rem),15%)+5.5rem+58%)/2)] -translate-x-1/2 -translate-y-1/2 [perspective:1200px] md:top-[40%]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Fade away before the next screen appears.
          exit={{ opacity: 0, transition: { duration: 0.3, ease: SILKY_EASE } }}
          transition={{
            delay: quietEntrance && !prefersReducedMotion ? 0.2 : 0,
            duration: prefersReducedMotion ? 0 : quietEntrance ? 0.35 : 1,
            ease: SILKY_EASE,
          }}
        >
          <motion.div style={{ y: driftY, rotate }}>
            <motion.div style={{ rotateX: tiltX, rotateY: tiltY }}>
              <AuraHeroCard
                faceCanvasRef={faceCanvasRef}
                className="h-[min(25dvh,calc((58dvh-max(calc(var(--safe-top)+2.5rem),15dvh)-7rem)/1.15))] min-h-[120px] md:h-[min(32dvh,340px)] md:min-h-[170px]"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Left: the name and the promise. */}
      <motion.div
        {...entrance(0.6)}
        className="absolute left-1/2 top-[max(calc(var(--safe-top)+2.5rem),15%)] -translate-x-1/2 text-center md:left-[8%] md:top-[42%] md:translate-x-0 md:text-left"
      >
        <h2 className="pl-[0.9em] text-2xl font-light tracking-[0.9em] md:pl-0 md:text-[28px]">
          {t("intro.title")}
        </h2>
        <p className="mt-3 whitespace-nowrap text-[9px] font-light leading-[2.2] tracking-[0.3em] text-white/60 md:mt-7 md:text-[11px] md:leading-[2.4] md:tracking-[0.42em]">
          {t("intro.tagline1")}
          <br />
          {t("intro.tagline2")}
        </p>
      </motion.div>

      {/* Right: what a reading is for. */}
      <motion.ul
        {...entrance(0.8)}
        className="absolute right-[7.5%] top-[44.5%] hidden flex-col items-end gap-3 text-[11px] font-light tracking-[0.42em] text-white/70 md:flex"
      >
        <li>{t("intro.pillar1")}</li>
        <li>{t("intro.pillar2")}</li>
        <li>{t("intro.pillar3")}</li>
        <li aria-hidden="true" className="mt-6 h-px w-8 bg-white/40" />
      </motion.ul>

      {/* Footer notes. */}
      <motion.p
        {...entrance(1.4)}
        className="absolute bottom-[calc(var(--safe-bottom)+3.5%)] left-[calc(var(--safe-left)+4%)] hidden text-[10px] font-light leading-[2] tracking-[0.42em] text-white/45 md:block"
      >
        {t("intro.footnote1")}
        <br />
        {t("intro.footnote2")}
      </motion.p>
      <motion.div
        {...entrance(1.4)}
        className="absolute bottom-[calc(var(--safe-bottom)+1rem)] right-[calc(var(--safe-right)+4%)] flex flex-col items-end gap-4 md:bottom-[calc(var(--safe-bottom)+4%)]"
      >
        {/* On phones the logo comes down from the header to sign the page. */}

        <p className="flex items-center gap-7 text-[9px] font-light tracking-[0.42em] text-white/45 md:text-[10px]">
          <FrankSignature className="h-7 w-auto text-white/80 md:hidden" />
        </p>
      </motion.div>
    </motion.div>
  );
};

export default IntroSection;
