import React from "react";
import { motion } from "motion/react";
import { SpreadType, TarotCard as TarotCardType, PickedCard } from "@/features/tarot/types";
import { SILKY_EASE } from "@/shared/constants/ui";
import { CARD_ASPECT_CLASS } from "@/features/tarot/constants/cards";
import { CardBackId } from "@/features/tarot/constants/cardBacks";
import CardBackSurface from "./CardBackSurface";

interface CloudCardRenderData {
  card: TarotCardType;
  x: number;
  y: number;
  randomRotate: number;
  cardWidth: string;
}

interface PickingCloudCardProps {
  card: TarotCardType;
  layoutId: string;
  isHovered: boolean;
  width: string;
  height?: string;
  style: React.CSSProperties;
  onHover: (id: number | null) => void;
  onClick: () => void;
  cardBackId: CardBackId;
}

const PickingCloudCard: React.FC<PickingCloudCardProps> = React.memo(
  ({ card, layoutId, isHovered, width, height = CARD_ASPECT_CLASS, style, onHover, onClick, cardBackId }) => {
    return (
      <motion.div
        style={{
          backfaceVisibility: "hidden",
          ...style,
        }}
        className={`relative cursor-pointer group ${width} ${height}`}
        onMouseEnter={() => onHover(card.id)}
        onMouseLeave={() => onHover(null)}
        onClick={onClick}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: isHovered ? 1.04 : 1, opacity: 1 }}
        transition={{ scale: { duration: 0.22, ease: SILKY_EASE }, opacity: { duration: 0.4 } }}
      >
        <motion.div
          className="w-full h-full relative"
          layoutId={layoutId}
          transition={{ layout: { type: "tween", duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-[1.2%] bg-black">
            <CardBackSurface cardBackId={cardBackId} />
          </div>
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 z-10 rounded-[1.2%] border transition-all duration-200 ${
              isHovered
                ? "border-white/55 shadow-[0_0_18px_rgba(255,255,255,0.26)]"
                : "border-white/0"
            }`}
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
  hoveredCardId: number | null;
  onCardHover: (id: number | null) => void;
  onCardSelect: (card: TarotCardType) => void;
  cardBackId: CardBackId;
}

const PickingSection: React.FC<PickingSectionProps> = ({
  spread,
  activeDeck,
  pickedCards,
  isMobile,
  isTablet,
  hoveredCardId,
  onCardHover,
  onCardSelect,
  cardBackId,
}) => {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
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
        const r3 =
          Math.sin(seed * 2) * 10000 - Math.floor(Math.sin(seed * 2) * 10000);

        const radius = 0.2 + Math.sqrt(r1) * 0.8;
        const angle = r2 * 2 * Math.PI;

        return {
          card,
          x: Math.cos(angle) * radiusX * radius,
          y: Math.sin(angle) * radiusY * radius,
          randomRotate: r3 * 360,
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        ref={stageRef}
        className="absolute inset-x-0 top-[calc(var(--safe-top)+3.5rem)] bottom-[calc(var(--safe-bottom)+8.5rem)] overflow-visible md:top-[calc(var(--safe-top)+6.5rem)] md:bottom-[calc(var(--safe-bottom)+5rem)]"
      >
        <div className="tarot-card-cloud absolute w-0 h-0 flex items-center justify-center top-1/2 left-1/2">
          {cloudCards.map(({ card, x, y, randomRotate, cardWidth }) => (
            <PickingCloudCard
              key={card.id}
              layoutId={`card-${card.id}`}
              card={card}
              isHovered={hoveredCardId === card.id}
              onHover={onCardHover}
              width={cardWidth}
              height={CARD_ASPECT_CLASS}
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
                rotate: `${randomRotate}deg`,
              }}
              onClick={() => onCardSelect(card)}
              cardBackId={cardBackId}
            />
          ))}
        </div>
      </div>
    </motion.div>

  </motion.div>
  );
};

export default PickingSection;
