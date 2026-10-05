import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CardPoolType, CardFaceStyle } from "@/features/tarot/types";
import { CARD_BACKS, CardBackId, getCardBack } from "@/features/tarot/constants/cardBacks";
import { CARD_FACE_STYLES, ORIGINAL_CARD_INSET_CLASS } from "@/features/tarot/constants/cardFaceStyles";
import { CARD_PACKS, CardPack, findPackByCombination } from "@/features/tarot/constants/cardPacks";
import {
  getDeckForPool,
  getCardImageUrl,
  CARD_ASPECT_CLASS,
} from "@/features/tarot/constants/cards";
import RitualCard from "./RitualCard";
import { useTranslation } from "react-i18next";
import CardBackSurface from "./CardBackSurface";
import { SlidersHorizontal, Check, Sparkles, ChevronDown } from "lucide-react";

interface DeckLibraryProps {
  selectedCardId: number | null;
  isMobile: boolean;
  isTablet: boolean;
  onCardFocus: (id: number | null) => void;
  cardBackId: CardBackId;
  onCardBackChange: (id: CardBackId) => void;
  cardFaceStyle: CardFaceStyle;
  onCardFaceStyleChange: (style: CardFaceStyle) => void;
  cardPackId?: string;
  onSelectPack?: (pack: CardPack) => void;
}

const DeckLibrary: React.FC<DeckLibraryProps> = ({
  selectedCardId,
  isMobile,
  isTablet,
  onCardFocus,
  cardBackId,
  onCardBackChange,
  cardFaceStyle,
  onCardFaceStyleChange,
  cardPackId,
  onSelectPack,
}) => {
  const { t } = useTranslation();
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<CardPoolType>("FULL");
  const [showCustomizer, setShowCustomizer] = useState(false);
  const isDesktopDetail = !isMobile && !isTablet;

  const activeMatchedPack = useMemo(
    () => findPackByCombination(cardFaceStyle, cardBackId),
    [cardFaceStyle, cardBackId]
  );

  const categories: { id: CardPoolType; label: string }[] = [
    { id: "FULL", label: t("deck.categories.FULL") },
    { id: "MAJOR", label: t("deck.categories.MAJOR") },
    { id: "SUIT_WANDS", label: t("deck.categories.SUIT_WANDS") },
    { id: "SUIT_CUPS", label: t("deck.categories.SUIT_CUPS") },
    { id: "SUIT_SWORDS", label: t("deck.categories.SUIT_SWORDS") },
    { id: "SUIT_PENTACLES", label: t("deck.categories.SUIT_PENTACLES") },
  ];

  const filteredCards = useMemo(
    () => getDeckForPool(activeCategory),
    [activeCategory]
  );

  const handlePackClick = (pack: CardPack) => {
    if (onSelectPack) {
      onSelectPack(pack);
    } else {
      onCardFaceStyleChange(pack.cardFaceStyle);
      onCardBackChange(pack.cardBackId);
    }
  };

  return (
    <div className="w-full pb-12 pt-24">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          animate={{
            opacity: selectedCardId === null ? 1 : 0.12,
            filter: selectedCardId === null ? "blur(0px)" : "blur(10px)",
          }}
          className={selectedCardId === null ? "pointer-events-auto" : "pointer-events-none"}
        >
          <h2 className="mb-2 text-center text-2xl text-white/90 font-cinzel tracking-[0.2em] md:text-3xl">
            {t("deck.title")}
          </h2>
          <p className="mb-10 text-center text-xs text-neutral-400 max-w-lg mx-auto leading-relaxed">
            {t("deck.packs.subtitle")}
          </p>

          {/* ═══════════ Card Packs Showcase ═══════════ */}
          <section className="mb-8 max-w-5xl mx-auto" aria-labelledby="card-packs-title">
            <div className="mb-6 flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-400/80" />
                <h3
                  id="card-packs-title"
                  className="text-xs text-white/80 font-cinzel uppercase tracking-[0.28em]"
                >
                  {t("deck.packs.title")}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              {CARD_PACKS.map((pack) => {
                const isSelected =
                  cardPackId === pack.id ||
                  (!cardPackId && activeMatchedPack?.id === pack.id);

                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => handlePackClick(pack)}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? `border-amber-400/80 bg-neutral-900/90 shadow-[0_0_36px_rgba(251,191,36,0.18)] ring-1 ring-amber-400/40`
                        : `border-white/10 bg-neutral-950/70 hover:border-white/25 hover:bg-neutral-900/60 hover:-translate-y-1`
                    }`}
                  >
                    {/* Atmospheric pack gradient aura */}
                    <div
                      className={`pointer-events-none absolute inset-0 bg-linear-to-b ${pack.glowColor} opacity-40 transition-opacity duration-300 group-hover:opacity-75`}
                    />

                    <div>
                      {/* Top Bar: Title & Tag */}
                      <div className="relative z-10 flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4
                              className={`text-sm font-cinzel tracking-wider uppercase ${
                                isSelected ? "text-amber-100 font-semibold" : "text-white/90"
                              }`}
                            >
                              {t(pack.nameKey)}
                            </h4>
                          </div>
                        </div>

                        {pack.tagKey && (
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-cinzel font-semibold tracking-wider uppercase border ${
                              isSelected
                                ? "bg-amber-400/20 text-amber-200 border-amber-400/50"
                                : "bg-white/10 text-white/70 border-white/15"
                            }`}
                          >
                            {t(pack.tagKey)}
                          </span>
                        )}
                      </div>

                      {/* Dual-Card 3D Composition Preview (Front + Back) */}
                      <div className="relative z-10 mx-auto my-5 h-44 w-full flex items-center justify-center">
                        {/* Card Back Preview (Angled left behind) */}
                        <div className="absolute left-1/2 -translate-x-[75%] top-2 h-38 w-[88px] -rotate-8 rounded-lg overflow-hidden border border-white/20 shadow-2xl transition-transform duration-300 group-hover:-translate-x-[82%] group-hover:-rotate-12">
                          <CardBackSurface cardBackId={pack.cardBackId} />
                          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                        </div>

                        {/* Card Front Preview (Angled right in front) */}
                        <div className="absolute left-1/2 -translate-x-[25%] top-0 h-38 w-[88px] rotate-6 rounded-lg overflow-hidden border border-white/30 shadow-[0_12px_28px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:-translate-x-[18%] group-hover:rotate-10 bg-black">
                          <img
                            src={getCardImageUrl(pack.previewCard, pack.cardFaceStyle)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className={`h-full w-full object-cover ${
                              pack.cardFaceStyle === "original" ? `absolute ${ORIGINAL_CARD_INSET_CLASS}` : ""
                            }`}
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <p className="relative z-10 text-[11px] text-neutral-400 leading-relaxed min-h-[34px]">
                        {t(pack.descriptionKey)}
                      </p>
                    </div>

                    {/* Bottom Status / Specs */}
                    <div className="relative z-10 mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 text-neutral-500">
                        <span className="capitalize">{pack.cardFaceStyle}</span>
                        <span>•</span>
                        <span className="capitalize">{getCardBack(pack.cardBackId).id.replace("-", " ")}</span>
                      </div>

                      {isSelected ? (
                        <span className="flex items-center gap-1 font-cinzel text-amber-300 font-medium">
                          <Check className="h-3 w-3" />
                          {t("deck.packs.selected")}
                        </span>
                      ) : (
                        <span className="text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          点击应用
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Mix Indicator & Granular Customization Toggle */}
            <div className="mt-6 flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => setShowCustomizer((prev) => !prev)}
                className="group flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/60 px-4 py-2 text-xs text-neutral-400 transition-all hover:border-white/25 hover:text-white hover:bg-neutral-800/80 cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400/70" />
                <span>
                  {showCustomizer ? t("deck.packs.hideCustomize") : t("deck.packs.customizePrompt")}
                </span>
                {!activeMatchedPack && (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.2 text-[9px] font-medium text-amber-300 border border-amber-400/30">
                    {t("deck.packs.customMix")}
                  </span>
                )}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    showCustomizer ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </section>

          {/* ═══════════ Granular Customization (Card Faces & Backs) ═══════════ */}
          <AnimatePresence>
            {showCustomizer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-b border-white/10 py-8 mb-12 bg-neutral-950/40"
              >
                {/* 1. Card Faces */}
                <section className="mb-10 max-w-3xl mx-auto" aria-labelledby="card-face-title">
                  <div className="mb-3 text-center">
                    <h4
                      id="card-face-title"
                      className="text-xs text-white/70 font-cinzel uppercase tracking-[0.28em]"
                    >
                      {t("deck.cardFaces.title")}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 border border-white/15 bg-neutral-950/80 p-1 gap-1">
                    {CARD_FACE_STYLES.map((styleOption) => {
                      const isSelected = cardFaceStyle === styleOption.id;
                      return (
                        <button
                          key={styleOption.id}
                          type="button"
                          onClick={() => onCardFaceStyleChange(styleOption.id)}
                          aria-pressed={isSelected}
                          className={`group relative flex items-center gap-3 p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer rounded-none ${
                            isSelected
                              ? "bg-white/10 text-amber-50 shadow-[inset_0_0_0_1px_rgba(250,231,188,0.4)]"
                              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                          }`}
                        >
                          <div className="relative h-13 w-8 shrink-0 overflow-hidden border border-white/20 bg-black">
                            <img
                              src={getCardImageUrl(styleOption.previewImage, styleOption.id)}
                              alt={t(styleOption.nameKey)}
                              loading="lazy"
                              decoding="async"
                              className={`h-full w-full object-cover ${
                                styleOption.id === "original"
                                  ? `absolute ${ORIGINAL_CARD_INSET_CLASS}`
                                  : ""
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] sm:text-xs font-cinzel uppercase tracking-[0.16em] truncate ${
                                  isSelected ? "text-amber-100 font-medium" : "text-white/80"
                                }`}
                              >
                                {t(styleOption.nameKey)}
                              </span>
                              {isSelected && (
                                <span className="shrink-0 text-[8px] font-cinzel tracking-wider text-amber-200 border border-amber-200/50 px-1 py-0.2">
                                  {t("deck.cardFaces.selected")}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[10px] text-neutral-400 leading-tight line-clamp-2">
                              {t(styleOption.descriptionKey)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 2. Card Backs */}
                <section className="max-w-5xl mx-auto" aria-labelledby="card-back-title">
                  <div className="mb-4 text-center">
                    <h4
                      id="card-back-title"
                      className="text-xs text-white/70 font-cinzel uppercase tracking-[0.28em]"
                    >
                      {t("deck.cardBacks.title")}
                    </h4>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {t("deck.cardBacks.subtitle")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-6 max-w-3xl mx-auto">
                    {CARD_BACKS.map((cardBack) => {
                      const isSelected = cardBackId === cardBack.id;
                      return (
                        <button
                          key={cardBack.id}
                          type="button"
                          onClick={() => onCardBackChange(cardBack.id)}
                          aria-pressed={isSelected}
                          className={`group relative text-left transition-transform duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
                            isSelected ? "scale-[1.02]" : "hover:-translate-y-1"
                          }`}
                        >
                          <div
                            className={`relative ${CARD_ASPECT_CLASS} overflow-hidden rounded-lg border bg-black p-1 transition-all duration-300 ${
                              isSelected
                                ? "border-amber-100/80 shadow-[0_0_24px_rgba(250,231,188,0.25)]"
                                : "border-white/10 group-hover:border-white/45"
                            }`}
                          >
                            <CardBackSurface cardBackId={cardBack.id} />
                            <div
                              className={`pointer-events-none absolute inset-0 border transition-opacity ${
                                isSelected
                                  ? "border-amber-100/60 opacity-100"
                                  : "border-white/0 opacity-0 group-hover:opacity-100"
                              }`}
                            />
                            {isSelected && (
                              <span className="absolute right-2 top-2 border border-amber-100/60 bg-black/65 px-1.5 py-0.5 text-[8px] text-amber-50 font-cinzel uppercase tracking-[0.14em] backdrop-blur-sm">
                                {t("deck.cardBacks.selected")}
                              </span>
                            )}
                          </div>
                          <span className="mt-2 block text-center text-[10px] text-white/75 font-cinzel uppercase tracking-[0.18em]">
                            {t(cardBack.nameKey)}
                          </span>
                          <span className="mt-0.5 block text-center text-[10px] text-neutral-500">
                            {t(cardBack.descriptionKey)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════ Card Filter Category Tabs ═══════════ */}
          <div className="-mx-4 mb-8 flex flex-wrap justify-center gap-2 border-b border-white/5 bg-black/80 px-4 py-4 backdrop-blur-md">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`border px-3 py-1.5 text-[10px] uppercase tracking-widest transition-all duration-300 md:text-xs ${
                  activeCategory === category.id
                    ? "border-white bg-white text-black"
                    : "border-neutral-800 bg-transparent text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ═══════════ Card Gallery Grid ═══════════ */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-8 lg:grid-cols-6">
          {filteredCards.map((card) => {
            const isDetailed = selectedCardId === card.id;
            const isHovered = hoveredCardId === card.id && selectedCardId === null;

            return (
              <div
                key={card.id}
                className={`flex justify-center ${CARD_ASPECT_CLASS}`}
              >
                <RitualCard
                  layoutId={`card-${card.id}`}
                  card={card}
                  isRevealed={true}
                  cardBackId={cardBackId}
                  cardFaceStyle={cardFaceStyle}
                  isDetailed={isDetailed}
                  isDesktopDetail={isDesktopDetail}
                  isHovered={isHovered}
                  onHover={setHoveredCardId}
                  onDetailClose={() => onCardFocus(null)}
                  onClick={
                    isDetailed
                      ? (event) => event.stopPropagation()
                      : () => {
                          setHoveredCardId(null);
                          onCardFocus(card.id);
                        }
                  }
                  width="w-full"
                  height={isDetailed ? "h-[100dvh]" : CARD_ASPECT_CLASS}
                  className={isDetailed ? "cursor-default" : ""}
                  style={{
                    position: isDetailed ? "fixed" : "relative",
                    inset: isDetailed ? 0 : "auto",
                    zIndex: isDetailed ? 10000 : "auto",
                  }}
                  animate={
                    isDetailed
                      ? { opacity: 1, filter: "blur(0px)" }
                      : {
                          opacity: selectedCardId === null ? 1 : 0.12,
                          filter: selectedCardId === null ? "blur(0px)" : "blur(10px)",
                        }
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DeckLibrary;
