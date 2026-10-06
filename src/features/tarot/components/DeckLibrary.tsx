import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CardPoolType, CardFaceStyle } from "@/features/tarot/types";
import { CARD_BACKS, CardBackId } from "@/features/tarot/constants/cardBacks";
import { CARD_FACE_STYLES } from "@/features/tarot/constants/cardFaceStyles";
import { CARD_PACKS, CardPack, findPackByCombination } from "@/features/tarot/constants/cardPacks";
import {
  getDeckForPool,
  FULL_DECK,
  CARD_ASPECT_CLASS,
} from "@/features/tarot/constants/cards";
import RitualCard from "./RitualCard";
import CardBackColorEditor from "./CardBackColorEditor";
import { useTranslation } from "react-i18next";
import SelectionTile from "@/shared/components/SelectionTile";
import { SlidersHorizontal, Check, ChevronDown } from "lucide-react";

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

const LibraryCardPreview: React.FC<{
  image: string;
  cardFaceStyle: CardFaceStyle;
  cardBackId: CardBackId;
  isRevealed: boolean;
  isHighlighted?: boolean;
}> = ({ image, cardFaceStyle, cardBackId, isRevealed, isHighlighted = false }) => (
  <RitualCard
    card={FULL_DECK.find((card) => card.image === image) ?? FULL_DECK[0]}
    cardFaceStyle={cardFaceStyle}
    cardBackId={cardBackId}
    isRevealed={isRevealed}
    isDetailed={false}
    isHovered={isHighlighted}
    showName={false}
    className="pointer-events-none"
  />
);

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
  const [hoveredPackId, setHoveredPackId] = useState<string | null>(null);
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

          <section className="mb-8 max-w-5xl mx-auto" aria-labelledby="card-packs-title">
            <h3
              id="card-packs-title"
              className="mb-6 text-center text-xs text-white/70 font-cinzel uppercase tracking-[0.28em]"
            >
              {t("deck.packs.title")}
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
              {CARD_PACKS.map((pack) => {
                const isSelected = cardPackId === pack.id ||
                  (!cardPackId && activeMatchedPack?.id === pack.id);
                const isHighlighted = isSelected || hoveredPackId === pack.id;

                return (
                  <SelectionTile
                    key={pack.id}
                    isSelected={isSelected}
                    onClick={() => handlePackClick(pack)}
                    onMouseEnter={() => setHoveredPackId(pack.id)}
                    onMouseLeave={() => setHoveredPackId(null)}
                    className="flex flex-col items-center p-5 text-center"
                  >
                    <h4 className="text-xs font-cinzel uppercase tracking-[0.16em] text-white/80">
                      {t(pack.nameKey)}
                    </h4>

                    <div aria-hidden="true" className="pointer-events-none relative mx-auto my-6 h-48 w-48">
                      <div className={`absolute left-3 top-3 w-[5.75rem] ${CARD_ASPECT_CLASS} -rotate-8 transition-transform duration-300 group-hover:-rotate-10`}>
                        <LibraryCardPreview
                          image={pack.previewCard}
                          cardFaceStyle={pack.cardFaceStyle}
                          cardBackId={pack.cardBackId}
                          isRevealed={false}
                          isHighlighted={isHighlighted}
                        />
                      </div>
                      <div className={`absolute right-4 top-0 w-[5.75rem] ${CARD_ASPECT_CLASS} rotate-6 transition-transform duration-300 group-hover:rotate-8`}>
                        <LibraryCardPreview
                          image={pack.previewCard}
                          cardFaceStyle={pack.cardFaceStyle}
                          cardBackId={pack.cardBackId}
                          isRevealed
                          isHighlighted={isHighlighted}
                        />
                      </div>
                    </div>

                    <p className="flex-1 text-[11px] leading-relaxed text-neutral-400">
                      {t(pack.descriptionKey)}
                    </p>
                    <span className={`mt-5 inline-flex items-center gap-1.5 text-[10px] tracking-[0.16em] ${isSelected ? "text-white/80" : "text-neutral-500"}`}>
                      {isSelected && <Check size={12} />}
                      {t(isSelected ? "deck.packs.selected" : "deck.packs.apply")}
                    </span>
                  </SelectionTile>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col items-center justify-center">
              <button
                type="button"
                aria-expanded={showCustomizer}
                aria-controls="deck-customizer"
                onClick={() => setShowCustomizer((prev) => !prev)}
                className="inline-flex items-center gap-2 border border-white/20 bg-white/5 px-4 py-2 text-xs text-neutral-400 tracking-wide transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <SlidersHorizontal size={14} />
                <span>{t(showCustomizer ? "deck.packs.hideCustomize" : "deck.packs.customizePrompt")}</span>
                {!activeMatchedPack && <span className="text-[10px] text-white/60">· {t("deck.packs.customMix")}</span>}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showCustomizer ? "rotate-180" : ""}`} />
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
                id="deck-customizer"
                className="overflow-hidden border-y border-white/10 py-8 mb-12"
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
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {CARD_FACE_STYLES.map((styleOption) => {
                      const isSelected = cardFaceStyle === styleOption.id;
                      return (
                        <SelectionTile
                          key={styleOption.id}
                          isSelected={isSelected}
                          onClick={() => onCardFaceStyleChange(styleOption.id)}
                          className="flex items-center gap-3 p-3"
                        >
                          <div aria-hidden="true" className={`pointer-events-none w-9 shrink-0 ${CARD_ASPECT_CLASS}`}>
                            <LibraryCardPreview
                              image={styleOption.previewImage}
                              cardFaceStyle={styleOption.id}
                              cardBackId={cardBackId}
                              isRevealed
                              isHighlighted={isSelected}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-cinzel uppercase tracking-[0.16em] text-white/80">
                              {t(styleOption.nameKey)}
                            </span>
                            <p className="mt-1 text-[10px] text-neutral-400 leading-relaxed line-clamp-2">
                              {t(styleOption.descriptionKey)}
                            </p>
                          </div>
                          {isSelected && <Check size={12} aria-label={t("deck.cardFaces.selected")} className="shrink-0 text-white/80" />}
                        </SelectionTile>
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-3xl mx-auto">
                    {CARD_BACKS.map((cardBack) => {
                      const isSelected = cardBackId === cardBack.id;
                      return (
                        <SelectionTile
                          key={cardBack.id}
                          isSelected={isSelected}
                          onClick={() => onCardBackChange(cardBack.id)}
                          className="flex flex-col items-center p-3 text-center"
                        >
                          <div aria-hidden="true" className={`pointer-events-none w-24 max-w-full ${CARD_ASPECT_CLASS}`}>
                            <LibraryCardPreview
                              image="maj00.png"
                              cardFaceStyle={cardFaceStyle}
                              cardBackId={cardBack.id}
                              isRevealed={false}
                            />
                          </div>
                          <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-white/75 font-cinzel uppercase tracking-[0.14em]">
                            {t(cardBack.nameKey)}
                            {isSelected && <Check size={12} aria-label={t("deck.cardBacks.selected")} />}
                          </span>
                          <span className="mt-1 text-[10px] text-neutral-500 leading-relaxed">
                            {t(cardBack.descriptionKey)}
                          </span>
                        </SelectionTile>
                      );
                    })}
                  </div>
                  <CardBackColorEditor />
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
