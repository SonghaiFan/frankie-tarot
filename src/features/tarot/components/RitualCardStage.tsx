import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { ChevronsDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CARD_ASPECT_CLASS, CARD_ASPECT_RATIO } from "@/features/tarot/constants/cards";
import { CardBackId } from "@/features/tarot/constants/cardBacks";
import { getLocalizedSpread, SPREADS } from "@/features/tarot/constants/spreads";
import { GameState, Locale, PickedCard, SpreadType, CardFaceStyle } from "@/features/tarot/types";
import { SILKY_EASE } from "@/shared/constants/ui";
import CardTooltip from "./CardTooltip";
import RitualCard from "./RitualCard";

const ABSOLUTE_LAYOUT_UNIT_REM = 0.25;

const parseWidthUnits = (widthClass: string) => {
  const match = widthClass.match(/\bw-(\d+(?:\d+)?)\b/);
  return match ? Number(match[1]) : null;
};

const getBalancedRows = <T,>(items: T[], maxColumns: number): T[][] => {
  if (items.length === 0) return [];

  const rowCount = Math.ceil(items.length / maxColumns);
  const baseRowSize = Math.floor(items.length / rowCount);
  const largerRowCount = items.length % rowCount;
  const rows: T[][] = [];
  let itemIndex = 0;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowSize = baseRowSize + (rowIndex < largerRowCount ? 1 : 0);
    rows.push(items.slice(itemIndex, itemIndex + rowSize));
    itemIndex += rowSize;
  }

  return rows;
};

interface RitualCardStageProps {
  gameState: GameState;
  spread: SpreadType;
  pickedCards: PickedCard[];
  revealedCardIds: Set<number>;
  hoveredCardId: number | null;
  selectedCardId: number | null;
  isMobile: boolean;
  isTablet: boolean;
  isShortViewport: boolean;
  onCardReveal: (id: number) => void;
  onCardHover: (id: number | null) => void;
  onCardFocus: (id: number | null) => void;
  cardBackId: CardBackId;
  cardFaceStyle?: CardFaceStyle;
}

const RitualCardStage: React.FC<RitualCardStageProps> = ({
  gameState,
  spread,
  pickedCards,
  revealedCardIds,
  hoveredCardId,
  selectedCardId,
  isMobile,
  isTablet,
  onCardReveal,
  onCardHover,
  onCardFocus,
  cardBackId,
  cardFaceStyle,
}) => {
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const absoluteStageRef = React.useRef<HTMLDivElement>(null);
  const [absoluteStageSize, setAbsoluteStageSize] = React.useState(() => ({
    width: typeof window === "undefined" ? 1152 : Math.min(1152, window.innerWidth - 64),
    height: typeof window === "undefined"
      ? 640
      : Math.min(768, Math.max(400, window.innerHeight * 0.72)),
  }));
  const { i18n } = useTranslation();
  const spreadConfig = getLocalizedSpread(spread, i18n.language as Locale);
  const displayedCards = pickedCards.slice(0, spreadConfig.cardCount);
  const isPicking = gameState === GameState.PICKING;
  const isReading = gameState === GameState.READING || gameState === GameState.REVEAL;
  // Width decides whether the spatial spread fits; a short desktop is still desktop.
  const useCompactLayout = absoluteStageSize.width < 960;
  const useGridLayout = useCompactLayout || spreadConfig.layoutType !== "absolute";
  const maxColumns = useCompactLayout ? 3 : Math.max(3, Math.min(6, Math.floor(absoluteStageSize.width / 190)));
  const compactCards = React.useMemo(
    () => displayedCards.map((card, index) => ({ card, index })),
    [displayedCards]
  );
  const compactRows = React.useMemo(
    () => getBalancedRows(compactCards, maxColumns),
    [compactCards, maxColumns]
  );
  const widestCompactRow = compactRows[0]?.length ?? 1;
  const gridGap = Math.min(32, absoluteStageSize.width * 0.035);
  const gridCardWidth = Math.min(
    widestCompactRow === 1 ? 208 : compactRows.length > 2 ? 144 : 184,
    (absoluteStageSize.width - 32 - gridGap * (widestCompactRow - 1)) / widestCompactRow
  );
  // On a phone a single row of cards must also fit the height left between a
  // notch or a host's bar (and the header under it) and the host's message
  // box, with room for the label and the prompt below. Taller spreads scroll.
  const gridCardSize = isMobile && compactRows.length === 1
    ? `min(${gridCardWidth}px, calc((100dvh - var(--safe-top) - var(--safe-bottom) - 14rem) / ${CARD_ASPECT_RATIO}))`
    : gridCardWidth;
  const allCardsRevealed =
    displayedCards.length > 0 &&
    displayedCards.every((card) => revealedCardIds.has(card.id));

  React.useLayoutEffect(() => {
    if (isPicking) return;
    const stage = absoluteStageRef.current;
    if (!stage) return;

    const updateStageSize = () => {
      const rect = stage.getBoundingClientRect();
      setAbsoluteStageSize({ width: rect.width, height: rect.height });
    };

    updateStageSize();
    const observer = new ResizeObserver(updateStageSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [spreadConfig.layoutType, isPicking]);

  React.useEffect(() => {
    if (!isReading || useCompactLayout) return;
    const handleMouseMove = (event: MouseEvent) => {
      setMousePos({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isReading, useCompactLayout]);

  const absoluteLayoutMetrics = React.useMemo(() => {
    if (spreadConfig.layoutType !== "absolute" || !spreadConfig.positions?.length) {
      return {
        offset: { x: 0, y: 0 },
        cardWidthUnits: null,
        boundsWidthUnits: 0,
        boundsHeightUnits: 0,
      };
    }

    const cardWidthUnits = parseWidthUnits(spreadConfig.cardSize.desktop);

    if (!cardWidthUnits) {
      return {
        offset: { x: 0, y: 0 },
        cardWidthUnits: null,
        boundsWidthUnits: 0,
        boundsHeightUnits: 0,
      };
    }

    const cardHeightUnits = cardWidthUnits * CARD_ASPECT_RATIO;
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minTop = Infinity;
    let maxBottom = -Infinity;

    spreadConfig.positions.forEach((position) => {
      const x = typeof position.x === "number" ? position.x : 0;
      const y = typeof position.y === "number" ? position.y : 0;
      const isRotated = !!position.rotation;
      const halfWidth = (isRotated ? cardHeightUnits : cardWidthUnits) / 2;
      const halfHeight = (isRotated ? cardWidthUnits : cardHeightUnits) / 2;

      minLeft = Math.min(minLeft, x - halfWidth);
      maxRight = Math.max(maxRight, x + halfWidth);
      minTop = Math.min(minTop, y - halfHeight);
      maxBottom = Math.max(maxBottom, y + halfHeight);
    });

    return {
      offset: {
        x: -((minLeft + maxRight) / 2),
        y: -((minTop + maxBottom) / 2),
      },
      cardWidthUnits,
      boundsWidthUnits: maxRight - minLeft,
      boundsHeightUnits: maxBottom - minTop,
    };
  }, [spreadConfig]);

  const absoluteLayoutScale = React.useMemo(() => {
    if (
      useCompactLayout ||
      !absoluteLayoutMetrics.boundsWidthUnits ||
      !absoluteLayoutMetrics.boundsHeightUnits
    ) {
      return 1;
    }

    const rootFontSize = typeof window === "undefined"
      ? 16
      : Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const unitPixels = rootFontSize * ABSOLUTE_LAYOUT_UNIT_REM;
    const horizontalPadding = Math.min(64, absoluteStageSize.width * 0.08);
    const verticalPadding = Math.min(48, absoluteStageSize.height * 0.08);
    const availableWidth = Math.max(1, absoluteStageSize.width - horizontalPadding * 2);
    const availableHeight = Math.max(1, absoluteStageSize.height - verticalPadding * 2);

    return Math.min(
      1,
      availableWidth / (absoluteLayoutMetrics.boundsWidthUnits * unitPixels),
      availableHeight / (absoluteLayoutMetrics.boundsHeightUnits * unitPixels)
    );
  }, [absoluteLayoutMetrics, absoluteStageSize, useCompactLayout]);

  const getAbsoluteCardStyle = (
    position: (typeof spreadConfig.positions)[number] | undefined,
    isHovered: boolean
  ): React.CSSProperties | undefined => {
    if (spreadConfig.layoutType !== "absolute" || useCompactLayout || !position) {
      return undefined;
    }

    const x = typeof position.x === "number" ? position.x : 0;
    const y = typeof position.y === "number" ? position.y : 0;
    const cardWidthUnits = absoluteLayoutMetrics.cardWidthUnits;
    if (!cardWidthUnits) return undefined;

    const cardWidthRem =
      cardWidthUnits * ABSOLUTE_LAYOUT_UNIT_REM * absoluteLayoutScale;
    const cardHeightRem = cardWidthRem * CARD_ASPECT_RATIO;
    const centerXRem =
      (absoluteLayoutMetrics.offset.x + x) *
      ABSOLUTE_LAYOUT_UNIT_REM *
      absoluteLayoutScale;
    const centerYRem =
      (absoluteLayoutMetrics.offset.y + y) *
      ABSOLUTE_LAYOUT_UNIT_REM *
      absoluteLayoutScale;

    return {
      position: "absolute",
      left: `calc(50% + ${centerXRem - cardWidthRem / 2}rem)`,
      top: `calc(50% + ${centerYRem - cardHeightRem / 2}rem)`,
      width: `${cardWidthRem}rem`,
      zIndex: isHovered ? 100 : position.zIndex || 5,
    };
  };

  const slotWidth =
    isMobile && (SPREADS[spread]?.cardCount ?? 0) > 5
      ? "w-[clamp(2rem,7vw,3rem)]"
      : "w-[clamp(2.5rem,8vmin,5rem)]";

  const hoveredCard = displayedCards.find((card) => card.id === hoveredCardId);
  const hoveredCardIndex = displayedCards.findIndex((card) => card.id === hoveredCardId);
  const hoveredCardLabel = hoveredCardIndex >= 0
    ? spreadConfig.layoutType === "absolute"
      ? spreadConfig.positions?.[hoveredCardIndex]?.label
      : spreadConfig.labels?.[hoveredCardIndex]
    : undefined;

  const handleCardClick = (id: number) => {
    if (!isReading) return;
    if (!revealedCardIds.has(id)) {
      onCardReveal(id);
      return;
    }
    onCardHover(null);
    onCardFocus(id);
  };

  const renderCard = (card: PickedCard, index: number) => {
    const isDetailed = selectedCardId === card.id;
    const isHovered = hoveredCardId === card.id && selectedCardId === null;
    const position = spreadConfig.positions?.[index];
    const readingWidth = spreadConfig.cardSize.desktop;
    const wrapperWidth = isPicking ? slotWidth : readingWidth;
    const usesScaledAbsoluteLayout =
      !isPicking && !useCompactLayout && spreadConfig.layoutType === "absolute";
    const absoluteStyle = isPicking
      ? undefined
      : getAbsoluteCardStyle(position, isHovered);
    const label = isPicking
      ? undefined
      : spreadConfig.layoutType === "absolute"
      ? position?.label
      : spreadConfig.labels?.[index];
    const labelPosition =
      spreadConfig.layoutType === "absolute" && !useCompactLayout
        ? position?.labelPosition || "bottom"
        : "bottom";

    return (
      <div
        key={card.id}
        style={!isPicking && useGridLayout ? {width: gridCardSize} : absoluteStyle}
        className={`pointer-events-none ${usesScaledAbsoluteLayout || (!isPicking && useGridLayout) ? "" : wrapperWidth} ${CARD_ASPECT_CLASS} shrink-0`}
      >
        <RitualCard
          layoutId={`card-${card.visualId ?? card.id}`}
          card={card}
          isRevealed={isReading && revealedCardIds.has(card.id)}
          cardBackId={cardBackId}
          cardFaceStyle={cardFaceStyle}
          isDetailed={isDetailed}
          isDesktopDetail={!isMobile && !isTablet}
          isHovered={isHovered}
          isHorizontal={
            isReading && !isDetailed && !!position?.rotation && !useCompactLayout
          }
          onHover={isReading ? onCardHover : undefined}
          onDetailClose={() => onCardFocus(null)}
          onClick={isDetailed
            ? (event) => event.stopPropagation()
            : () => handleCardClick(card.id)}
          label={isDetailed ? undefined : label}
          labelPosition={labelPosition}
          width="w-full"
          height={isDetailed ? "h-[100dvh]" : CARD_ASPECT_CLASS}
          className={`${isPicking ? "pointer-events-none" : "pointer-events-auto"} ${
            isDetailed ? "cursor-default" : ""
          }`}
          style={{
            position: isDetailed ? "fixed" : "relative",
            inset: isDetailed ? 0 : "auto",
            zIndex: isDetailed ? 10000 : "auto",
          }}
          animate={isDetailed
            ? { opacity: 1, filter: "blur(0px)" }
            : {
                opacity: selectedCardId === null ? 1 : 0.16,
                filter: selectedCardId === null ? "blur(0px)" : "blur(12px)",
              }}
        />
      </div>
    );
  };

  return (
    <>
      <section
        className={isPicking
          ? "pointer-events-none absolute inset-0 z-30"
          : "relative z-20 flex w-full shrink-0 items-center justify-center"}
        data-tarot-stage="cards"
        // Room for the cards is what is left once a notch or a host's bar and
        // message box are taken off, so the prompt below stays in view.
        style={isPicking ? undefined : {minHeight: useGridLayout && compactRows.length <= 2 ? "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 14rem)" : useGridLayout ? undefined : "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 9rem)"}}
      >
        <div
          ref={absoluteStageRef}
          className={isPicking
            ? "absolute inset-x-0 bottom-[calc(var(--safe-bottom)+1.5rem)] flex justify-center gap-[clamp(0.25rem,1vw,0.75rem)] px-4 md:bottom-10"
            : useGridLayout
            ? "flex w-full flex-col items-center gap-y-12 px-2 py-8"
            : spreadConfig.layoutType === "absolute"
            ? "relative mx-auto h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-4rem)] min-h-[20rem] w-full"
            : "flex flex-wrap items-center justify-center gap-6 md:gap-12"}
        >
          {!isPicking && useGridLayout
            ? compactRows.map((row, rowIndex) => (
                <div
                  key={`compact-row-${rowIndex}`}
                  className="flex w-full items-start justify-center"
                  style={{gap: gridGap}}
                >
                  {row.map(({ card, index }) => renderCard(card, index))}
                </div>
              ))
            : displayedCards.map((card, index) => renderCard(card, index))}
        </div>

        {!useCompactLayout && isReading && allCardsRevealed && selectedCardId === null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--safe-bottom)+0.75rem)] flex justify-center text-white/40">
            <ChevronsDown className="h-5 w-5" aria-hidden="true" strokeWidth={1.25} />
            <span className="sr-only">
              {i18n.t("reading.scrollForReading")}
            </span>
          </div>
        )}
      </section>

      {createPortal(
        <AnimatePresence>
          {hoveredCardId !== null && isReading && !useCompactLayout && selectedCardId === null && (
            <CardTooltip
              x={mousePos.x + 15}
              y={mousePos.y + 15}
              isRevealed={revealedCardIds.has(hoveredCardId)}
              card={hoveredCard}
              positionLabel={hoveredCardLabel}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default RitualCardStage;
