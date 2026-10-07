import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronUp } from "lucide-react";
import { SpreadType } from "@/features/tarot/types";
import { SILKY_EASE } from "@/shared/constants/ui";
import { getLocalizedSpread, SPREADS } from "@/features/tarot/constants/spreads";
import { useTranslation } from "react-i18next";
import { Locale } from "@/features/tarot/types";
import SelectionTile from "@/shared/components/SelectionTile";

interface InputSectionProps {
  primaryActionRef: React.RefObject<(() => void) | null>;
  onConfirmationChange: (confirmed: boolean) => void;
  question: string;
  spread: SpreadType | null;
  onQuestionChange: (value: string) => void;
  onSpreadChange: (spread: SpreadType) => void;
  onStartRitual: () => void;
  isMobile: boolean;
  isTablet: boolean;
  isThinking?: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({
  question,
  spread,
  primaryActionRef,
  onConfirmationChange,
  onQuestionChange,
  onSpreadChange,
  onStartRitual,
  isMobile,
  isTablet,
  isThinking = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const [isSpreadConfirmed, setIsSpreadConfirmed] = useState(!!spread);
  const [direction, setDirection] = useState(0); // 0: initial, 1: forward, -1: backward

  // -- 占位符逻辑 --
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setPlaceholderIndex(0);
    const interval = setInterval(
      () => setPlaceholderIndex((prev) => prev + 1),
      3000
    );
    return () => clearInterval(interval);
  }, [spread]);

  const getPlaceholder = () => {
    if (!spread) return t("input.fallbackPlaceholder");
    const questions = getLocalizedSpread(spread, locale).defaultQuestions;
    return questions && questions.length > 0
      ? questions[placeholderIndex % questions.length]
      : t("input.fallbackPlaceholder");
  };

  // -- 核心动效变体 (滚动飞出效果) --
  // Page changes slide and fade only — no blur — and settle quickly.
  const pageVariants = {
    enter: (dir: number) => ({
      y: dir > 0 ? 40 : -40, // 前进时从下入，后退时从上入
      opacity: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.45, ease: SILKY_EASE },
    },
    exit: (dir: number) => ({
      y: dir > 0 ? -40 : 40, // 前进时向上出，后退时向下出
      opacity: 0,
      transition: { duration: 0.3, ease: SILKY_EASE },
    }),
  };

  const handleConfirm = () => {
    setDirection(1); // 前进
    setIsSpreadConfirmed(true);
  };

  const handleBack = () => {
    setDirection(-1); // 后退
    setIsSpreadConfirmed(false);
  };

  React.useLayoutEffect(() => {
    primaryActionRef.current = isSpreadConfirmed ? onStartRitual : handleConfirm;
    onConfirmationChange(isSpreadConfirmed);
  });

  return (
    // 修改说明：
    // 1. min-h-[80vh] + justify-center: 实现垂直居中
    // 2. items-center: 实现水平居中
    // 3. overflow-hidden: 保持动画边界整洁
    <div className="w-full max-w-3xl px-0 sm:px-4 flex flex-col justify-center items-center min-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-7.5rem)] pt-4 pb-[max(8rem,25dvh)] md:pt-8 relative">
      <AnimatePresence mode="wait" custom={direction}>
        {/* === PHASE 1: SPREAD SELECTION (选牌阵) === */}
        {!isSpreadConfirmed ? (
          <motion.div
            key="selection-phase"
            custom={direction}
            variants={pageVariants}
            initial={direction === 0 ? "center" : "enter"}
            animate="center"
            exit="exit"
            className="w-full flex flex-col gap-[clamp(1.5rem,6dvh,4rem)] items-center"
          >

            {/* Spread Grid */}
            <div className="w-full space-y-6">
              <Label text={t("input.chooseSpread")} />
              <SubLabel text={t("input.chooseSpreadHint")} />

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                {Object.values(SPREADS).map((s) => (
                  <SpreadCard
                    key={s.id}
                    item={s}
                    isSelected={spread === s.id}
                    onClick={() => onSpreadChange(s.id)}
                  />
                ))}
              </div>

              {/* Description Panel (Phase 1) */}
              <DescriptionPanel spread={spread} />


            </div>
          </motion.div>
        ) : (
          /* === PHASE 2: QUESTION INPUT (提问) === */
          <motion.div
            key="question-phase"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            // 增加 pt-20，给顶部带有文字的箭头留出足够空间
            className="w-full flex flex-col items-center relative pt-[clamp(4rem,10dvh,5rem)] px-1 sm:px-4"
          >
            {/* Back Arrow with Hint */}
            <motion.button
              onClick={handleBack}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              // 使用 group 让 hover 状态同时作用于图标和文字
              className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20 group cursor-pointer py-4"
            >
              <div className="text-white/30 group-hover:text-white/80 transition-colors duration-500">
                <ChevronUp size={24} />
              </div>
              <span className="text-[9px] tracking-[0.2em] text-white/20 group-hover:text-white/60 transition-colors duration-500 uppercase">
                {t("input.reselect")}
              </span>
            </motion.button>

            {/* === 上下文区域：展示选定的牌阵信息 === */}
            <div className="flex flex-col items-center gap-3 w-full max-w-lg">
              {spread && SPREADS[spread] && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5, ease: SILKY_EASE }}
                  className="flex justify-center"
                >
                  <div className="text-white/90 h-14 w-14 relative flex items-center justify-center glow-sm">
                    {SPREADS[spread].icon(true)}
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col items-center gap-2">
                <SubLabel
                  text={
                    spread
                      ? t("input.selectedSpread", {
                          name: getLocalizedSpread(spread, locale).name,
                        })
                      : ""
                  }
                />
              </div>
            </div>

            {/* === 交互区域：提问 === */}
            {/* mt-8 md:mt-12 拉开与上方牌阵信息的距离，强调现在的重点是提问 */}
            <div className="w-full mt-8 md:mt-12 space-y-6 relative">
              <div className="text-center space-y-2 md:space-y-4">
                <p className="text-base md:text-lg text-neutral-200 font-serif tracking-wide whitespace-pre-line">
                  {t("input.meditation")}
                </p>
                <Label text={t("input.enterQuestion")} />
              </div>

              {/* Input Field Container */}
              <div className="relative w-full mt-6 group">
                <AnimatePresence mode="wait">
                  {!question && !isFocused && (
                    <motion.div
                      key={getPlaceholder()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.45, ease: SILKY_EASE }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <span className="text-lg md:text-4xl lg:text-5xl text-white/10 font-serif tracking-wide text-center px-4 whitespace-nowrap overflow-hidden text-ellipsis">
                        {getPlaceholder()}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <input
                  type="text"
                  autoComplete="off"
                  value={question}
                  onChange={(e) => onQuestionChange(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="w-full bg-transparent border-b border-white/10 py-4 md:py-8 text-center text-xl md:text-4xl lg:text-5xl text-white focus:outline-none focus:border-white/40 transition-all duration-700 font-serif tracking-wide relative z-10"
                />
              </div>


            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Helper Components ---

const Label = ({ text }: { text: string }) => (
  <label className="text-[10px] tracking-[0.3em] text-neutral-500 uppercase block text-center">
    {text}
  </label>
);

const SubLabel = ({ text }: { text: string }) => (
  <p className="text-center text-xs text-neutral-400">{text}</p>
);

const DescriptionPanel = ({ spread }: { spread: SpreadType | null }) => {
  const { i18n } = useTranslation();
  const locale = i18n.language as Locale;
  return (
    <div className="text-center space-y-2">
      <AnimatePresence mode="wait">
        <motion.p
          key={spread || "none"}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="text-xs text-white/40 font-light tracking-wide whitespace-pre-line"
        >
          {spread ? getLocalizedSpread(spread, locale).description : ""}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

const SpreadCard = ({
  item,
  isSelected,
  onClick,
}: {
  item: any;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const { i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const localized = getLocalizedSpread(item.id, locale);

  return (
    <SelectionTile
      isSelected={isSelected}
      onClick={onClick}
      className="p-1 md:p-4 duration-500 flex flex-col items-center gap-1 md:gap-4"
    >
      <div className="flex gap-1 items-center justify-center h-6 w-6 md:h-8 md:w-8 relative">
        {item.icon(isSelected)}
      </div>
      <span
        className={`text-[9px] md:text-[10px] tracking-wide transition-colors text-center leading-tight ${isSelected ? "text-white" : "text-white/40"
          }`}
      >
        {localized.name}
      </span>
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute top-1 right-1 md:top-2 md:right-2 text-white/60"
          >
            <Check size={10} className="md:w-3 md:h-3" />
          </motion.div>
        )}
      </AnimatePresence>
    </SelectionTile>
  );
};

export default InputSection;
