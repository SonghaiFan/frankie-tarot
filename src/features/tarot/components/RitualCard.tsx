import React from "react";
import {
  HTMLMotionProps,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useTranslation } from "react-i18next";
import { CARD_ASPECT_CLASS, getCardImageUrl } from "@/features/tarot/constants/cards";
import { CardBackId } from "@/features/tarot/constants/cardBacks";
import { ORIGINAL_CARD_INSET_CLASS } from "@/features/tarot/constants/cardFaceStyles";
import { PickedCard, TarotCard as TarotCardData, CardFaceStyle } from "@/features/tarot/types";
import { getRomanNumeral } from "@/features/tarot/utils/getRomanNumeral";
import { SILKY_EASE } from "@/shared/constants/ui";
import CardBackSurface from "./CardBackSurface";

interface RitualCardProps extends Omit<HTMLMotionProps<"div">, "onAnimationStart"> {
  card: PickedCard | TarotCardData;
  isRevealed: boolean;
  cardBackId: CardBackId;
  cardFaceStyle?: CardFaceStyle;
  isDetailed: boolean;
  isDesktopDetail?: boolean;
  isHovered?: boolean;
  isHorizontal?: boolean;
  label?: string;
  labelPosition?: "top" | "bottom" | "left" | "right";
  width?: string;
  height?: string;
  onHover?: (id: number | null) => void;
  onDetailClose?: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const layoutTransition = {
  type: "tween" as const,
  duration: 0.52,
  ease: [0.22, 1, 0.36, 1] as const,
};

const labelClasses = {
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
};

const RitualCard: React.FC<RitualCardProps> = ({
  card,
  isRevealed,
  cardBackId,
  cardFaceStyle = "redraw",
  isDetailed,
  isDesktopDetail = false,
  isHovered = false,
  isHorizontal = false,
  label,
  labelPosition = "bottom",
  width = "w-full",
  height = CARD_ASPECT_CLASS,
  onHover,
  onDetailClose,
  className = "",
  style,
  onClick,
  layoutId,
  ...motionProps
}) => {
  const { t, i18n } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const isEnglish = i18n.language === "en";
  const artworkRef = React.useRef<HTMLDivElement>(null);
  const [isImageLoaded, setIsImageLoaded] = React.useState(false);
  const [hasImageError, setHasImageError] = React.useState(false);
  const [detailFaceMode, setDetailFaceMode] = React.useState<"redraw" | "original" | "diff">(
    cardFaceStyle === "original" ? "original" : "redraw"
  );
  const [splitPos, setSplitPos] = React.useState(cardFaceStyle === "original" ? 100 : 0);
  const [isAnimatingSlide, setIsAnimatingSlide] = React.useState(false);
  const isDraggingSplit = React.useRef(false);
  const sliderContainerRef = React.useRef<HTMLDivElement>(null);
  const animationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (isDetailed) {
      if (cardFaceStyle === "original") {
        setDetailFaceMode("original");
        setSplitPos(100);
      } else {
        setDetailFaceMode("redraw");
        setSplitPos(0);
      }
    }
  }, [cardFaceStyle, isDetailed]);

  React.useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const activeCardImageUrl = React.useMemo(() => {
    return getCardImageUrl(card.image, cardFaceStyle);
  }, [card.image, cardFaceStyle]);

  const isCurrentFaceOriginal = cardFaceStyle === "original";

  React.useEffect(() => {
    setIsImageLoaded(false);
    setHasImageError(false);
  }, [activeCardImageUrl]);

  const updateSplitFromPointer = React.useCallback((clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const rawRatio = (clientX - rect.left) / rect.width;
    const x = clamp(rawRatio, 0, 1);
    const percent = Math.round(x * 100);
    setSplitPos(percent);
  }, []);

  const handleSliderPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (detailFaceMode !== "diff") return;
      e.stopPropagation();
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      setIsAnimatingSlide(false);
      isDraggingSplit.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      updateSplitFromPointer(e.clientX);
    },
    [detailFaceMode, updateSplitFromPointer]
  );

  const handleSliderPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingSplit.current || detailFaceMode !== "diff") return;
      e.stopPropagation();
      updateSplitFromPointer(e.clientX);
    },
    [detailFaceMode, updateSplitFromPointer]
  );

  const handleSliderPointerUp = React.useCallback((e: React.PointerEvent) => {
    if (isDraggingSplit.current) {
      isDraggingSplit.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  }, []);

  const scrollProgress = useMotionValue(0);
  const artworkScale = useTransform(scrollProgress, [0, 1], [1, 0.76]);
  const artworkY = useTransform(scrollProgress, [0, 1], [0, -72]);
  const artworkOpacity = useTransform(scrollProgress, [0, 1], [1, 0.16]);
  const blurAmount = useTransform(scrollProgress, [0, 1], [0, 18]);
  const artworkFilter = useMotionTemplate`blur(${blurAmount}px)`;
  const hintOpacity = useTransform(scrollProgress, [0, 0.18], [1, 0]);
  const cardTiltX = useMotionValue(0);
  const cardTiltY = useMotionValue(0);
  const detailTiltX = useMotionValue(0);
  const detailTiltY = useMotionValue(0);
  const smoothCardTiltX = useSpring(cardTiltX, {
    stiffness: 220,
    damping: 24,
    mass: 0.7,
  });
  const smoothCardTiltY = useSpring(cardTiltY, {
    stiffness: 220,
    damping: 24,
    mass: 0.7,
  });
  const smoothDetailTiltX = useSpring(detailTiltX, {
    stiffness: 190,
    damping: 24,
    mass: 0.75,
  });
  const smoothDetailTiltY = useSpring(detailTiltY, {
    stiffness: 190,
    damping: 24,
    mass: 0.75,
  });
  const cardSheenAngle = useTransform(
    () => `${118 + smoothCardTiltY.get() * 2.8 - smoothCardTiltX.get() * 1.6}deg`
  );
  const cardSheenPeak = useTransform(
    () => `${44 + smoothCardTiltY.get() * 1.2 - smoothCardTiltX.get() * 0.65}%`
  );
  const cardSheenStrength = useTransform(() =>
    clamp(
      (Math.abs(smoothCardTiltX.get()) + Math.abs(smoothCardTiltY.get())) / 28,
      0.14,
      0.4
    )
  );
  const cardGlare = useMotionTemplate`linear-gradient(${cardSheenAngle}, rgba(255,255,255,0) 8%, rgba(255,248,229,0.16) 28%, rgba(255,244,214,${cardSheenStrength}) ${cardSheenPeak}, rgba(255,255,255,0.12) 80%, rgba(255,255,255,0) 100%)`;
  const detailSheenAngle = useTransform(
    () => `${112 + smoothDetailTiltY.get() * 2.6 - smoothDetailTiltX.get() * 1.4}deg`
  );
  const detailSheenPeak = useTransform(
    () => `${40 + smoothDetailTiltY.get() * 1.15 - smoothDetailTiltX.get() * 0.55}%`
  );
  const detailSheenStrength = useTransform(() =>
    clamp(
      (Math.abs(smoothDetailTiltX.get()) + Math.abs(smoothDetailTiltY.get())) / 24,
      0.16,
      0.44
    )
  );
  const detailSurface = useMotionTemplate`linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 34%, rgba(0,0,0,0.16) 100%), linear-gradient(${detailSheenAngle}, rgba(255,255,255,0) 5%, rgba(255,248,230,0.17) 25%, rgba(246,223,177,${detailSheenStrength}) ${detailSheenPeak}, rgba(255,255,255,0.14) 84%, rgba(255,255,255,0) 100%)`;

  const primaryName = isEnglish ? card.nameEn : card.nameCn;
  const secondaryName = isEnglish ? "" : card.nameEn;
  const keywords = isEnglish ? card.keywordsEn ?? [] : card.keywords;
  const positiveMeaning = isEnglish ? card.positiveEn : card.positive;
  const negativeMeaning = isEnglish ? card.negativeEn : card.negative;
  const description = isEnglish ? card.descriptionEn : card.descriptionCn;
  const romanNumeral = getRomanNumeral(card.id);
  const isReversed = "isReversed" in card && card.isReversed;
  const [isSnappingToSpreadOrientation, setIsSnappingToSpreadOrientation] =
    React.useState(false);

  const requestDetailClose = React.useCallback(() => {
    if (!onDetailClose) return;

    if (isReversed) {
      // Restore the spread orientation on this frame, without rotating through it.
      setIsSnappingToSpreadOrientation(true);
      window.requestAnimationFrame(() => setIsSnappingToSpreadOrientation(false));
    }

    onDetailClose();
  }, [isReversed, onDetailClose]);

  const isArtworkReversed = isReversed && !isDetailed;
  const shouldSnapArtworkOrientation =
    isDetailed || isSnappingToSpreadOrientation;

  React.useLayoutEffect(() => {
    if (!isDetailed || isDesktopDetail) scrollProgress.set(0);
  }, [isDetailed, isDesktopDetail, scrollProgress]);

  React.useLayoutEffect(() => {
    if (!isDetailed || !isDesktopDetail) {
      detailTiltX.set(0);
      detailTiltY.set(0);
    }
  }, [detailTiltX, detailTiltY, isDetailed, isDesktopDetail]);

  React.useLayoutEffect(() => {
    if (isDetailed) {
      cardTiltX.set(0);
      cardTiltY.set(0);
    }
  }, [cardTiltX, cardTiltY, isDetailed]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (isDesktopDetail) return;
    const { scrollTop, clientHeight } = event.currentTarget;
    scrollProgress.set(clamp(scrollTop / Math.max(1, clientHeight * 0.72), 0, 1));
  };

  const resetDetailTilt = React.useCallback(() => {
    detailTiltX.set(0);
    detailTiltY.set(0);
  }, [detailTiltX, detailTiltY]);

  const handleTabSelect = React.useCallback(
    (mode: "original" | "diff" | "redraw") => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      setIsAnimatingSlide(true);
      setDetailFaceMode(mode);
      resetDetailTilt();
      if (mode === "original") {
        setSplitPos(100);
      } else if (mode === "redraw") {
        setSplitPos(0);
      } else {
        setSplitPos(50);
      }
      animationTimerRef.current = setTimeout(() => {
        setIsAnimatingSlide(false);
      }, 480);
    },
    [resetDetailTilt]
  );

  const resetCardTilt = React.useCallback(() => {
    cardTiltX.set(0);
    cardTiltY.set(0);
  }, [cardTiltX, cardTiltY]);

  const handleCardPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || isDetailed || event.pointerType !== "mouse") {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);

      cardTiltX.set((0.5 - py) * 15);
      cardTiltY.set((px - 0.5) * 18);
    },
    [cardTiltX, cardTiltY, isDetailed, prefersReducedMotion]
  );

  const handleDetailPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        prefersReducedMotion ||
        !isDetailed ||
        !isDesktopDetail ||
        event.pointerType !== "mouse" ||
        detailFaceMode === "diff"
      ) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);

      detailTiltX.set((0.5 - py) * 10);
      detailTiltY.set((px - 0.5) * 12);
    },
    [detailFaceMode, detailTiltX, detailTiltY, isDetailed, isDesktopDetail, prefersReducedMotion]
  );

  const imageFilter = isHovered || isDetailed
    ? "grayscale(0%) contrast(1.1) brightness(1.05)"
    : "grayscale(100%) contrast(1.2) brightness(0.9)";

  const handleRootClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDetailed || !onDetailClose) {
      onClick?.(event);
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const artworkBounds = artworkRef.current?.getBoundingClientRect();
    const clickedArtwork = artworkBounds
      ? event.clientX >= artworkBounds.left &&
        event.clientX <= artworkBounds.right &&
        event.clientY >= artworkBounds.top &&
        event.clientY <= artworkBounds.bottom
      : false;
    const clickedContent = !!target?.closest(
      "[data-card-detail-content], [data-card-detail-control], button, a"
    );

    if (!clickedArtwork && !clickedContent) {
      event.stopPropagation();
      requestDetailClose();
      return;
    }

    onClick?.(event);
  };

  return (
    <motion.div
      className={`${
        isDetailed
          ? isDesktopDetail
            ? "grid grid-cols-[48%_52%] items-center"
            : "flex items-center justify-center"
          : "relative cursor-pointer group"
      } ${width} ${height} ${className}`}
      style={{
        rotate: isDetailed ? undefined : isHorizontal ? 90 : 0,
        touchAction: isDetailed ? "pan-y" : undefined,
        ...style,
      }}
      onClick={handleRootClick}
      onPointerMove={!isDetailed ? handleCardPointerMove : undefined}
      onPointerLeave={!isDetailed ? resetCardTilt : undefined}
      onMouseEnter={() => !isDetailed && onHover?.(card.id)}
      onMouseLeave={() => {
        if (!isDetailed) {
          resetCardTilt();
          onHover?.(null);
        }
      }}
      {...motionProps}
    >
      {isDetailed && (
        <div
          className={isDesktopDetail
            ? "absolute inset-y-0 right-0 z-30 w-[52%] overflow-y-auto overscroll-y-contain bg-transparent outline-none"
            : "absolute inset-0 z-30 overflow-y-auto overscroll-y-contain bg-transparent outline-none touch-pan-y"}
          onScroll={handleScroll}
          tabIndex={0}
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          <div className={isDesktopDetail ? "hidden" : "relative h-[100dvh] w-full pointer-events-none"}>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40" />
            <motion.div
              className="pointer-events-none absolute bottom-[calc(var(--safe-bottom)+1.75rem)] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/55"
              style={{ opacity: hintOpacity }}
            >
              <span className="h-8 w-px bg-linear-to-b from-white/0 to-white/65" />
              <span className="text-[9px] uppercase tracking-[0.28em]">{t("card.scrollToRead")}</span>
            </motion.div>
          </div>

          <div className={isDesktopDetail
            ? "relative z-30 flex min-h-full flex-col items-start justify-center bg-transparent py-[clamp(5rem,10vh,8rem)] pl-[clamp(2rem,4vw,5rem)] pr-[max(3rem,6vw)]"
            : "relative z-30 -mt-16 bg-linear-to-b from-transparent to-black"}>
            <div data-card-detail-content className={isDesktopDetail
              ? "w-full max-w-2xl text-left"
              : "px-6 pb-7 pt-24 text-center md:px-12 md:pb-10"}>
              {romanNumeral && (
                <div className="mb-2 text-sm text-amber-50/60 font-cinzel tracking-[0.2em] md:text-base">
                  {romanNumeral}
                </div>
              )}
              <h2 className="mb-3 text-3xl text-amber-50/90 font-cinzel tracking-widest md:text-5xl">
                {primaryName}
              </h2>
              {(secondaryName || isReversed) && (
                <p className="mb-5 text-sm text-neutral-400 font-serif tracking-wide md:text-lg">
                  {secondaryName}
                  {secondaryName && isReversed ? " " : ""}
                  {isReversed && (
                    <span className="ml-2 italic text-red-400/80">({t("card.reversedLong")})</span>
                  )}
                </p>
              )}
              {keywords.length > 0 && (
                <div className={`flex flex-wrap gap-2 md:gap-3 ${isDesktopDetail ? "justify-start" : "justify-center"}`}>
                  {keywords.map((keyword) => (
                    <span key={keyword} className="rounded-sm border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-neutral-300 tracking-[0.15em] uppercase md:px-3 md:text-xs">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>

              <div data-card-detail-content className={isDesktopDetail
                ? "mt-10 w-full max-w-2xl space-y-8"
                : "px-6 pb-[calc(var(--safe-bottom)+5rem)] pt-2 md:px-12 md:pb-20 lg:px-14"}>
              <div className={isDesktopDetail ? "space-y-8" : "mx-auto max-w-2xl space-y-8"}>
                {(positiveMeaning || negativeMeaning) && (
                  <div>
                    <h4 className={`mb-4 text-[10px] text-neutral-500 uppercase tracking-[0.3em] ${isDesktopDetail ? "text-left" : "text-center"}`}>
                      {t("card.interpretationTitle")}
                    </h4>
                    <p className="text-sm text-neutral-300 font-light leading-relaxed text-justify tracking-wide md:text-base md:leading-loose">
                      {positiveMeaning && (
                        <span className="mb-2 block text-neutral-200">
                          <span className="mr-2 text-xs text-neutral-400">＋</span>{positiveMeaning}
                        </span>
                      )}
                      {negativeMeaning && (
                        <span className="block text-neutral-400">
                          <span className="mr-2 text-xs text-neutral-500">－</span>{negativeMeaning}
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {description && (
                  <div className="border-t border-white/5 pt-8">
                    <h4 className={`mb-4 text-[10px] text-neutral-500 uppercase tracking-[0.3em] ${isDesktopDetail ? "text-left" : "text-center"}`}>
                      {t("card.arcanaWisdom")}
                    </h4>
                    <p className={`text-sm text-neutral-300 font-light leading-relaxed text-justify tracking-wide md:text-base md:leading-loose ${isEnglish ? "italic" : ""}`}>
                      {description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <motion.div
        ref={artworkRef}
        layout
        layoutId={layoutId as string | undefined}
        className={isDetailed
          ? isDesktopDetail
            ? `relative z-20 col-start-1 justify-self-center w-[min(23rem,32vw,64dvh)] ${CARD_ASPECT_CLASS} pointer-events-auto`
            : `relative z-20 w-[min(22rem,72vw,44dvh)] ${CARD_ASPECT_CLASS} pointer-events-auto`
          : "absolute inset-0 z-20"}
        transition={{ layout: layoutTransition }}
        onPointerMove={isDetailed && isDesktopDetail ? handleDetailPointerMove : undefined}
        onPointerLeave={isDetailed && isDesktopDetail ? resetDetailTilt : undefined}
        style={!prefersReducedMotion
          ? isDetailed && isDesktopDetail
            ? {
                scale: 1,
                y: 0,
                opacity: 1,
                filter: "none",
              }
            : {
                scale: artworkScale,
                y: artworkY,
                opacity: artworkOpacity,
                filter: artworkFilter,
              }
          : {
              scale: 1,
              y: 0,
              opacity: 1,
              filter: "blur(0px)",
            }}
      >
        {isDetailed && (
          <motion.div
            data-card-detail-control
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="absolute -top-11 left-1/2 -translate-x-1/2 z-40 flex items-center border border-white/15 bg-black/90 p-0.5 shadow-[0_4px_24px_rgba(0,0,0,0.8)] backdrop-blur-md pointer-events-auto select-none whitespace-nowrap rounded-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. 1909 Original (Left) -> Slide reveal left side */}
            <button
              type="button"
              data-card-detail-control
              onClick={() => handleTabSelect("original")}
              className={`px-3 py-1 text-[10px] font-cinzel tracking-[0.22em] uppercase transition-all duration-200 cursor-pointer rounded-none ${
                detailFaceMode === "original"
                  ? "bg-white/10 text-amber-100 border-b border-amber-200/90 font-medium"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border-b border-transparent"
              }`}
            >
              {t("card.diffMode.original")}
            </button>
            <span className="h-3 w-px bg-white/15" />

            {/* 2. Interactive Sliding Diff (Center) -> Slide to 50% */}
            <button
              type="button"
              data-card-detail-control
              onClick={() => handleTabSelect("diff")}
              className={`px-3 py-1 text-[10px] font-cinzel tracking-[0.22em] uppercase transition-all duration-200 flex items-center gap-1.5 cursor-pointer rounded-none ${
                detailFaceMode === "diff"
                  ? "bg-white/10 text-amber-100 border-b border-amber-200/90 font-medium"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border-b border-transparent"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <rect x="3" y="3" width="18" height="18" rx="0" ry="0" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
              {t("card.diffMode.diff")}
            </button>
            <span className="h-3 w-px bg-white/15" />

            {/* 3. Redraw (Right) -> Slide reveal right side */}
            <button
              type="button"
              data-card-detail-control
              onClick={() => handleTabSelect("redraw")}
              className={`px-3 py-1 text-[10px] font-cinzel tracking-[0.22em] uppercase transition-all duration-200 cursor-pointer rounded-none ${
                detailFaceMode === "redraw"
                  ? "bg-white/10 text-amber-100 border-b border-amber-200/90 font-medium"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border-b border-transparent"
              }`}
            >
              {t("card.diffMode.redraw")}
            </button>
          </motion.div>
        )}

        {isDetailed && detailFaceMode === "diff" && (
          <motion.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-6.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-neutral-400 font-cinzel tracking-[0.24em] uppercase pointer-events-none"
          >
            {t("card.diffMode.hint")}
          </motion.div>
        )}

        <motion.div
          className="relative h-full w-full"
          style={{
            rotateX:
              !prefersReducedMotion && isDetailed && isDesktopDetail
                ? smoothDetailTiltX
                : !prefersReducedMotion && !isDetailed
                  ? smoothCardTiltX
                  : 0,
            rotateY:
              !prefersReducedMotion && isDetailed && isDesktopDetail
                ? smoothDetailTiltY
                : !prefersReducedMotion && !isDetailed
                  ? smoothCardTiltY
                  : 0,
            transformPerspective: 1400,
            transformStyle: "preserve-3d",
            willChange: isDetailed && isDesktopDetail ? "transform" : undefined,
          }}
        >
        <motion.div
          className="relative h-full w-full"
          initial={false}
          animate={{ rotateY: isDetailed || isRevealed ? 0 : 180 }}
          transition={{ duration: isDetailed ? 0 : 0.28, ease: SILKY_EASE }}
          style={{ transformStyle: "preserve-3d", willChange: "transform" }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-[1.2%] bg-white p-[2%] shadow-[0_28px_60px_rgba(0,0,0,0.55)]"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <div className="relative h-full w-full overflow-hidden border border-black/80 bg-neutral-950">
              {isDetailed ? (
                <div
                  ref={sliderContainerRef}
                  data-card-detail-control
                  className={`absolute inset-0 h-full w-full overflow-hidden select-none pointer-events-auto ${
                    detailFaceMode === "diff" ? "touch-none cursor-ew-resize" : "cursor-default"
                  }`}
                  onPointerDown={detailFaceMode === "diff" ? handleSliderPointerDown : undefined}
                  onPointerMove={detailFaceMode === "diff" ? handleSliderPointerMove : undefined}
                  onPointerUp={detailFaceMode === "diff" ? handleSliderPointerUp : undefined}
                  onPointerCancel={detailFaceMode === "diff" ? handleSliderPointerUp : undefined}
                >
                  {/* Base Layer: 1909 Original (Visible on left) */}
                  <img
                    src={getCardImageUrl(card.image, "original")}
                    alt={`${card.nameEn} (1909 Original)`}
                    draggable={false}
                    decoding="async"
                    loading="eager"
                    className={`absolute ${ORIGINAL_CARD_INSET_CLASS} object-cover pointer-events-none`}
                    style={{ filter: imageFilter }}
                  />

                  {/* Top Layer: Redraw (Visible on right, clipped from left) */}
                  <div
                    className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none"
                    style={{
                      clipPath: `inset(0 0 0 ${splitPos}%)`,
                      transition: isAnimatingSlide ? "clip-path 0.45s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
                      willChange: isAnimatingSlide || isDraggingSplit.current ? "clip-path" : undefined,
                    }}
                  >
                    <img
                      src={getCardImageUrl(card.image, "redraw")}
                      alt={`${card.nameEn} (Redraw)`}
                      draggable={false}
                      decoding="async"
                      loading="eager"
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ filter: imageFilter }}
                    />
                  </div>

                  {/* Split Divider */}
                  <div
                    className="absolute inset-y-0 z-20 w-0 pointer-events-none transition-opacity duration-300"
                    style={{
                      left: `${splitPos}%`,
                      transition: isAnimatingSlide
                        ? "left 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease"
                        : "opacity 0.3s ease",
                      opacity: splitPos <= 0.5 || splitPos >= 99.5 ? 0 : 1,
                      willChange: isAnimatingSlide || isDraggingSplit.current ? "left" : undefined,
                    }}
                  >
                    <div className="absolute inset-y-0 -left-[0.5px] w-px bg-linear-to-b from-amber-100/10 via-amber-200/95 to-amber-100/10 shadow-[0_0_8px_rgba(250,231,188,0.7)]" />
                  </div>
                </div>
              ) : (
                <motion.img
                  src={activeCardImageUrl}
                  alt={card.nameEn}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setIsImageLoaded(true)}
                  onError={() => {
                    setIsImageLoaded(true);
                    setHasImageError(true);
                  }}
                  className={`absolute object-cover transition-[filter,opacity] duration-500 ${
                    isCurrentFaceOriginal
                      ? ORIGINAL_CARD_INSET_CLASS
                      : "inset-0 h-full w-full"
                  } ${isImageLoaded ? "opacity-100" : "opacity-0"}`}
                  style={{ filter: imageFilter }}
                  initial={false}
                  animate={{ rotateZ: isArtworkReversed ? 180 : 0 }}
                  transition={{
                    duration: shouldSnapArtworkOrientation ? 0 : 0.32,
                    ease: SILKY_EASE,
                  }}
                />
              )}
              {hasImageError && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 p-4 text-center text-xs text-white/40 font-cinzel tracking-widest uppercase">
                  {card.nameEn}
                </div>
              )}
              {!isImageLoaded && !hasImageError && !isDetailed && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                </div>
              )}
              <div
                className={`absolute inset-0 pointer-events-none ${
                  !isDetailed
                    ? "bg-linear-to-t from-black/95 via-black/20 to-black/40"
                    : "hidden"
                }`}
              />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 mix-blend-screen"
                animate={{
                  opacity: isDetailed && isDesktopDetail ? 0.92 : isHovered ? 0.95 : 0,
                  scale: isDetailed || isHovered ? 1 : 0.96,
                }}
                transition={{ duration: 0.35, ease: SILKY_EASE }}
                style={{ background: isDetailed ? detailSurface : cardGlare }}
              />
              <div
                className={`absolute bottom-0 w-full p-3 text-center transition-opacity duration-300 md:p-4 ${
                  isRevealed && !isDetailed ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {romanNumeral && <div className="mb-0.5 text-[8px] text-white/60 font-cinzel tracking-[0.2em] md:text-[10px]">{romanNumeral}</div>}
                <h2 className="mb-0.5 truncate text-[10px] text-white font-cinzel tracking-widest md:text-sm">{primaryName}</h2>
                {(secondaryName || isReversed) && (
                  <p className="truncate text-[9px] text-neutral-400 font-serif md:text-[10px]">
                    {secondaryName}
                    {secondaryName && isReversed ? " " : ""}
                    {isReversed && <span className="ml-1 italic text-red-400/80">({t("card.reversedShort")})</span>}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div
            className="absolute inset-0 overflow-hidden bg-black"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardBackSurface cardBackId={cardBackId} className="border border-black/80" />
          </div>
          {!isDetailed && (
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 z-10 border transition-all duration-300 ${
                isHovered
                  ? "border-white/55 shadow-[0_0_24px_rgba(255,255,255,0.3),0_0_42px_rgba(255,255,255,0.12),inset_0_0_18px_rgba(255,255,255,0.08)]"
                  : "border-white/0 shadow-none group-hover:border-white/55 group-hover:shadow-[0_0_24px_rgba(255,255,255,0.3),0_0_42px_rgba(255,255,255,0.12),inset_0_0_18px_rgba(255,255,255,0.08)]"
              }`}
            />
          )}
        </motion.div>
        </motion.div>
      </motion.div>

      {isDetailed && onDetailClose && (
        <motion.button
          type="button"
          aria-label="Back"
          className="fixed left-[calc(var(--safe-left)+0.75rem)] top-[calc(var(--safe-top)+0.75rem)] z-[10001] flex items-center gap-2 p-2 text-white/60 transition-colors hover:text-white md:left-8 md:top-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={(event) => {
            event.stopPropagation();
            requestDetailClose();
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="hidden text-[10px] uppercase tracking-widest md:inline">Back</span>
        </motion.button>
      )}

      {!isDetailed && label && (
        <div className={`absolute whitespace-nowrap text-[8px] text-neutral-600 tracking-[0.2em] uppercase pointer-events-none md:text-[9px] ${labelClasses[labelPosition]}`}>
          {label}
        </div>
      )}
    </motion.div>
  );
};

export default RitualCard;
