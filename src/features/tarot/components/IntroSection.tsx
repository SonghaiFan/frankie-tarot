import React, { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTime, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SILKY_EASE } from "@/shared/constants/ui";
import AuraHeroCard from "./AuraHeroCard";
import { HORIZON_FRACTION, SKY_GRADIENT_CSS } from "./introScene";
import PlanetCanvas from "./PlanetCanvas";
import StarTrails from "./StarTrails";
import WaterReflection from "./WaterReflection";

interface IntroSectionProps {
  onEnter: () => void;
}

const HORIZON = `${HORIZON_FRACTION * 100}%`;
// The card's slow drift: a 10s bob and sway around a 15° lean.
const DRIFT_PERIOD_MS = 10_000;
const LEAN = 15;
const MAX_TILT = 8;
const tiltSpring = { stiffness: 110, damping: 18, mass: 0.8 };

const fadeIn = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 1.4, ease: SILKY_EASE },
});

/** The home page: one card floating over still water, and a single way in. */
const IntroSection: React.FC<IntroSectionProps> = ({ onEnter }) => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const tiltX = useSpring(useMotionValue(0), tiltSpring);
  const tiltY = useSpring(useMotionValue(0), tiltSpring);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  // Driven by values (not keyframes) so the water can mirror the exact pose.
  const time = useTime();
  const phase = useTransform(time, (ms) => (prefersReducedMotion ? 0 : Math.sin((ms / DRIFT_PERIOD_MS) * Math.PI * 2)));
  const driftY = useTransform(phase, (p) => p * -6);
  const rotate = useTransform(phase, (p) => LEAN + p);

  useEffect(() => {
    if (prefersReducedMotion) return;
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
  }, [prefersReducedMotion, tiltX, tiltY]);

  return (
    <motion.div
      key="intro"
      className="fixed inset-0 z-20 overflow-hidden font-display text-white"
      exit={{ opacity: 0, filter: "blur(20px)", transition: { duration: 1 } }}
    >
      {/* The sky, its stars turning about the pole, and the planet in front of them. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0" style={{ height: HORIZON, background: SKY_GRADIENT_CSS }} />
      <motion.div aria-hidden="true" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2.4 }}>
        <StarTrails horizon={HORIZON_FRACTION} animated={!prefersReducedMotion} />
      </motion.div>
      <motion.div aria-hidden="true" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2.4, ease: SILKY_EASE }}>
        <PlanetCanvas />
      </motion.div>

      {/* The water: everything below the horizon (also the fallback without WebGL). */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-linear-to-b from-[#05070e] to-[#010103]" style={{ top: HORIZON }} />
      <WaterReflection horizon={HORIZON_FRACTION} faceCanvasRef={faceCanvasRef} rotate={rotate} animated={!prefersReducedMotion} />

      {/* The horizon: a haze band above it, a hairline across, and a bright
          core under the card with a long horizontal flare. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ top: HORIZON }}>
        <div className="absolute inset-x-0 bottom-0 h-[12vh] bg-linear-to-b from-transparent to-[rgba(120,140,210,0.07)]" />
        <div className="absolute inset-x-0 h-px -translate-y-1/2 bg-linear-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute left-1/2 h-[3px] w-[min(70vw,900px)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(255,238,226,0.85),rgba(255,214,190,0.25)_35%,transparent_70%)] blur-[1.5px]" />
        <div className="absolute left-1/2 h-24 w-[min(38vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(255,232,216,0.35),rgba(200,190,230,0.08)_45%,transparent_70%)] blur-lg" />
        <div className="absolute left-1/2 h-3 w-40 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(255,255,255,0.95),rgba(255,236,222,0.4)_40%,transparent_72%)] blur-[2px]" />
      </div>

      {/* The card, floating just above the water. */}
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 [perspective:1200px] md:top-[40%]">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.8, ease: SILKY_EASE }}
        >
          <motion.div style={{ y: driftY, rotate }}>
            <motion.div style={{ rotateX: tiltX, rotateY: tiltY }}>
              <AuraHeroCard faceCanvasRef={faceCanvasRef} className="h-[min(25dvh,240px)] min-h-[150px] md:h-[min(32dvh,340px)] md:min-h-[170px]" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Left: the name and the promise. */}
      <motion.div {...fadeIn(0.6)} className="absolute left-1/2 top-[calc(var(--safe-top)+4.5rem)] -translate-x-1/2 text-center md:left-[8%] md:top-[42%] md:translate-x-0 md:text-left">
        <h2 className="pl-[0.9em] text-2xl font-light tracking-[0.9em] md:pl-0 md:text-[28px]">{t("intro.title")}</h2>
        <p className="mt-3 whitespace-nowrap text-[9px] font-light leading-[2.2] tracking-[0.3em] text-white/60 md:mt-7 md:text-[11px] md:leading-[2.4] md:tracking-[0.42em]">
          {t("intro.tagline1")}<br />{t("intro.tagline2")}
        </p>
      </motion.div>

      {/* Right: what a reading is for. */}
      <motion.ul {...fadeIn(0.8)} className="absolute right-[7.5%] top-[44.5%] hidden flex-col items-end gap-3 text-[11px] font-light tracking-[0.42em] text-white/70 md:flex">
        <li>{t("intro.pillar1")}</li>
        <li>{t("intro.pillar2")}</li>
        <li>{t("intro.pillar3")}</li>
        <li aria-hidden="true" className="mt-6 h-px w-8 bg-white/40" />
      </motion.ul>

      {/* The one way in. */}
      <motion.div {...fadeIn(1.2)} className="absolute left-1/2 top-[73%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-6">
        <button
          type="button"
          onClick={onEnter}
          aria-label={t("intro.enter")}
          className="group grid size-20 place-items-center rounded-full border border-white/45 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.16),rgba(255,255,255,0.03)_60%)] backdrop-blur-md shadow-[0_0_40px_rgba(255,200,170,0.12)] transition-[border-color,box-shadow,transform] duration-500 hover:scale-105 hover:border-white/80 hover:shadow-[0_0_60px_rgba(255,200,170,0.28)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black md:size-[88px]"
        >
          <ArrowRight size={22} strokeWidth={1} className="transition-transform duration-500 group-hover:translate-x-0.5" />
        </button>
        <span aria-hidden="true" className="pl-[0.42em] text-[11px] font-light tracking-[0.42em] text-white/80">{t("intro.enter")}</span>
      </motion.div>

      {/* Footer notes. */}
      <motion.p {...fadeIn(1.4)} className="absolute bottom-[calc(var(--safe-bottom)+3.5%)] left-[calc(var(--safe-left)+4%)] hidden text-[10px] font-light leading-[2] tracking-[0.42em] text-white/45 md:block">
        {t("intro.footnote1")}<br />{t("intro.footnote2")}
      </motion.p>
      <motion.p {...fadeIn(1.4)} className="absolute bottom-[calc(var(--safe-bottom)+4%)] right-[calc(var(--safe-right)+4%)] flex items-center gap-7 text-[9px] font-light tracking-[0.42em] text-white/45 md:text-[10px]">
        {t("intro.madeBy")}
        <span aria-hidden="true" className="h-px w-8 bg-white/35" />
      </motion.p>
    </motion.div>
  );
};

export default IntroSection;
