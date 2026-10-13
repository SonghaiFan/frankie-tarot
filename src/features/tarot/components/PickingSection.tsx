import { CARD_CORNER_CLASS } from "@/features/tarot/constants/cardDimensions";
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { SpreadType, TarotCard as TarotCardType, PickedCard } from "@/features/tarot/types";
import { camera, SHOTS } from "@/features/tarot/scene/camera";
import { SILKY_EASE } from "@/shared/constants/ui";

import { CARD_ASPECT_CLASS } from "@/features/tarot/constants/cards";
import { CardBackId } from "@/features/tarot/constants/cardBacks";
import CardBackSurface from "./CardBackSurface";
import PickingCloudCanvas from "./PickingCloudCanvas";

interface CloudCardRenderData {
  card: TarotCardType;
  x: number;
  y: number;
  rotation: number;
  cardWidth: string;
  arrivalX: number;
  arrivalY: number;
  arrivalDelay: number;
}

interface PickingCloudCardProps {
  gpuReady: boolean;
  card: TarotCardType;
  layoutId: string;
  width: string;
  height?: string;
  rotation: number;
  onSelect: (card: TarotCardType) => void;
  cardBackId: CardBackId;
}

const PickingCloudCard: React.FC<PickingCloudCardProps> = React.memo(
  ({ gpuReady, card, layoutId, width, height = CARD_ASPECT_CLASS, rotation, onSelect, cardBackId }) => {
    const touchStart = React.useRef<{x: number; y: number} | null>(null);
    const ignoreClickUntil = React.useRef(0);
    return (
      <motion.div
        data-cloud-card={card.id}
        data-rotation={rotation}
        role="button"
        tabIndex={0}
        aria-label={`Select card ${card.id + 1}`}
        style={{
          touchAction: "manipulation",
          backfaceVisibility: "hidden",
          position: "absolute",
          left: 0,
          top: 0,
          transform: "translate(-50%, -50%)",
          rotate: `${rotation}deg`,
        }}
        className={`relative cursor-pointer group ${width} ${height}`}
        onPointerDown={event => {
          if (event.pointerType !== "mouse" && event.isPrimary) touchStart.current = {x: event.clientX, y: event.clientY};
        }}
        onPointerCancel={() => { touchStart.current = null; }}
        onPointerUp={event => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || !event.isPrimary || event.pointerType === "mouse") return;
          if (Math.hypot(event.clientX-start.x,event.clientY-start.y)>10) return;
          event.preventDefault();
          ignoreClickUntil.current = performance.now() + 700;
          onSelect(card);
        }}
        onClick={event => {
          // Touch has already selected on release. Click remains for mouse,
          // keyboard and assistive technologies; selection is also idempotent.
          if ((event.nativeEvent as PointerEvent).pointerType === "touch" || performance.now() < ignoreClickUntil.current) return;
          onSelect(card);
        }}
        onKeyDown={event => {
          if(event.key === "Enter" || event.key === " ") { event.preventDefault();onSelect(card); }
        }}
        initial={false}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.04 }}
        transition={{ scale: { duration: 0.22, ease: SILKY_EASE }, opacity: { duration: 0.4 } }}
      >
        <motion.div
          className="w-full h-full relative"
          layoutId={layoutId}
          transition={{ layout: { type: "tween", duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
          style={{ backfaceVisibility: "hidden" }}
        >
          {!gpuReady && <div className={`absolute inset-0 overflow-hidden ${CARD_CORNER_CLASS} bg-black`}>
            <CardBackSurface cardBackId={cardBackId} />
          </div>}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 z-10 ${CARD_CORNER_CLASS} border border-white/55 shadow-[0_0_18px_rgba(255,255,255,0.26)] opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
          />
        </motion.div>
      </motion.div>
    );
  }
);

PickingCloudCard.displayName = "PickingCloudCard";

interface PickingSectionProps {
  spread: SpreadType;
  activeDeck: TarotCardType[];
  pickedCards: PickedCard[];
  isMobile: boolean;
  isTablet: boolean;
  onCardSelect: (card: TarotCardType) => void;
  cardBackId: CardBackId;
}

const PickingSection: React.FC<PickingSectionProps> = ({
  spread,
  activeDeck,
  pickedCards,
  isMobile,
  isTablet,
  onCardSelect,
  cardBackId,
}) => {
  const reducedMotion = useReducedMotion();
  const [gpuReady, setGpuReady] = React.useState(false);
  // Hover changes must not invalidate every memoized card via a new callback.
  const selectRef = React.useRef(onCardSelect);
  React.useLayoutEffect(() => { selectRef.current = onCardSelect; }, [onCardSelect]);
  const selectCard = React.useCallback((card: TarotCardType) => selectRef.current(card), []);
  const stageRef = React.useRef<HTMLDivElement>(null);
  // WebKit synthesizes a mouse click after touch release, and can retarget it
  // to the next card when the selected DOM node has already disappeared.
  const suppressCompatibilityClickUntil = React.useRef(0);
  const [stageSize, setStageSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Do not mount card layout nodes during camera travel: their first layout
  // otherwise captures the previous page and can flash a miniature deck.
  const [cameraReady, setCameraReady] = React.useState(false);
  React.useLayoutEffect(() => {
    const update = () => setCameraReady(
      Math.abs(camera.zoom.get() - SHOTS.picking.zoom) < 0.001 &&
      Math.abs(camera.x.get() - SHOTS.picking.x) < 0.001 &&
      Math.abs(camera.y.get() - SHOTS.picking.y) < 0.001
    );
    const unsubscribe = [camera.zoom, camera.x, camera.y].map(value => value.on("change", update));
    update();
    return () => unsubscribe.forEach(stop => stop());
  }, []);

  const pickedIdSet = React.useMemo(() => {
    return new Set(pickedCards.map((c) => c.visualId ?? c.id));
  }, [pickedCards]);

  const cloudCards = React.useMemo<CloudCardRenderData[]>(() => {
    const stageWidth = stageSize.width || (isMobile ? 360 : isTablet ? 820 : 1280);
    const stageHeight = stageSize.height || (isMobile ? 520 : 720);
    const shortSide = Math.min(stageWidth, stageHeight);
    const estimatedCardWidth = Math.min(96, Math.max(40, shortSide * 0.08));
    const estimatedCardHeight = estimatedCardWidth * 1.72;
    const cardBoundingRadius = Math.hypot(estimatedCardWidth, estimatedCardHeight) / 2;
    const radiusX = Math.max(72, stageWidth / 2 - cardBoundingRadius - 8);
    const radiusY = Math.max(72, stageHeight / 2 - cardBoundingRadius - 8);
    const cardWidth = "w-[clamp(2.5rem,8vmin,6rem)]";

    return activeDeck
      .filter((card) => !pickedIdSet.has(card.id))
      .map((card) => {
        const seed = card.id * 123.45;
        const r1 = Math.sin(seed) * 10000 - Math.floor(Math.sin(seed) * 10000);
        const r2 = Math.cos(seed) * 10000 - Math.floor(Math.cos(seed) * 10000);
        const r3 = Math.sin(seed * 2) * 10000 - Math.floor(Math.sin(seed * 2) * 10000);

        const radius = 0.2 + Math.sqrt(r1) * 0.8;
        const angle = r2 * 2 * Math.PI;

        return {
          card,
          x: Math.cos(angle) * radiusX * radius,
          y: Math.sin(angle) * radiusY * radius,
          rotation: r3 * 360,
          arrivalX: Math.cos(r3 * Math.PI * 2) * (24 + r1 * 40),
          arrivalY: Math.sin(r3 * Math.PI * 2) * (24 + r1 * 40),
          arrivalDelay: r2 * 0.1,
          cardWidth,
        };
      });
  }, [activeDeck, isMobile, isTablet, pickedIdSet, stageSize.height, stageSize.width]);

  return (
  <motion.div
    key="picking"
    className="relative w-full h-full flex items-center justify-center"
  >
    {/* Background Elements - Fade out on exit */}
    <motion.div
      className="absolute inset-0 w-full h-full"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        ref={stageRef}
        onPointerDownCapture={event => {
          if (event.pointerType !== "mouse") suppressCompatibilityClickUntil.current = performance.now() + 700;
        }}
        onPointerUpCapture={event => {
          if (event.pointerType !== "mouse") suppressCompatibilityClickUntil.current = performance.now() + 700;
        }}
        onClickCapture={event => {
          if (event.detail > 0 && performance.now() < suppressCompatibilityClickUntil.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className="absolute inset-x-0 top-[calc(var(--safe-top)+6rem)] bottom-[calc(var(--safe-bottom)+5rem)] overflow-visible md:top-[calc(var(--safe-top)+6.5rem)] md:bottom-[calc(var(--safe-bottom)+5rem)]"
      >
        <PickingCloudCanvas stageRef={stageRef} cardBackId={cardBackId} onReady={setGpuReady} />
        {cameraReady && stageSize.width > 0 && stageSize.height > 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: SILKY_EASE }} className="tarot-card-cloud absolute w-0 h-0 flex items-center justify-center top-1/2 left-1/2">
          {cloudCards.map(({ card, x, y, rotation, cardWidth, arrivalX, arrivalY, arrivalDelay }) => (
            <motion.div key={card.id} className="absolute" style={{ left: x, top: y }}
              initial={reducedMotion ? false : { x: arrivalX, y: arrivalY, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.32, delay: reducedMotion ? 0 : arrivalDelay, ease: SILKY_EASE }}
            >
              <PickingCloudCard
                gpuReady={gpuReady}
                layoutId={`card-${card.id}`}
                card={card}
                width={cardWidth}
                height={CARD_ASPECT_CLASS}
                rotation={rotation}
                onSelect={selectCard}
                cardBackId={cardBackId}
              />
            </motion.div>
          ))}
        </motion.div>}
      </div>
    </motion.div>

  </motion.div>
  );
};

export default PickingSection;
