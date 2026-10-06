import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { useCardBackAppearance } from "@/features/tarot/hooks/useCardBackAppearance";
import {
  DEFAULT_CARD_BACK_APPEARANCE,
  MAX_AURA_COLORS,
  setCardBackAppearance,
} from "@/features/tarot/services/cardBackAppearance";

const CardBackColorEditor: React.FC = () => {
  const { t } = useTranslation();
  const appearance = useCardBackAppearance();
  const isSolid = appearance.mode === "solid";
  const colors = isSolid ? [appearance.solidColor] : appearance.colors;

  const updateColor = (index: number, color: string) => {
    setCardBackAppearance(isSolid
      ? { ...appearance, solidColor: color }
      : { ...appearance, colors: appearance.colors.map((value, i) => i === index ? color : value) }
    );
  };

  return (
    <div className="mx-auto mt-6 max-w-3xl border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <span className="text-neutral-400">{t("deck.backColors.title")}</span>
        <div className="flex items-center gap-4">
          {(["gradient", "solid"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={appearance.mode === mode}
              onClick={() => setCardBackAppearance({ ...appearance, mode })}
              className={`border-b py-1 transition-colors focus-visible:outline-1 focus-visible:outline-white ${appearance.mode === mode ? "border-white/60 text-white" : "border-transparent text-neutral-500 hover:text-white"}`}
            >
              {t(`deck.backColors.${mode}`)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCardBackAppearance(DEFAULT_CARD_BACK_APPEARANCE)}
            className="text-neutral-500 transition-colors hover:text-white focus-visible:outline-1 focus-visible:outline-white"
          >
            {t("deck.backColors.reset")}
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {colors.map((color, index) => (
          <div key={index} className="relative h-10 w-10">
            <input
              type="color"
              value={color}
              aria-label={t("deck.backColors.color", { number: index + 1 })}
              title={`${t("deck.backColors.color", { number: index + 1 })} · ${color}`}
              onChange={(event) => updateColor(index, event.target.value)}
              className="h-full w-full cursor-pointer appearance-none border border-white/20 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:border-0"
            />
            {!isSolid && (
              <button
                type="button"
                disabled={colors.length <= 2}
                aria-label={t("deck.backColors.remove", { number: index + 1 })}
                onClick={() => setCardBackAppearance({ ...appearance, colors: colors.filter((_, i) => i !== index) })}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center border border-white/20 bg-neutral-950 text-neutral-300 hover:text-white disabled:hidden focus-visible:outline-1 focus-visible:outline-white"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        {!isSolid && (
          <button
            type="button"
            disabled={colors.length >= MAX_AURA_COLORS}
            aria-label={t("deck.backColors.add")}
            title={t("deck.backColors.add")}
            onClick={() => setCardBackAppearance({ ...appearance, colors: [...colors, "#ffffff"] })}
            className="flex h-10 w-10 items-center justify-center border border-dashed border-white/20 text-neutral-400 transition-colors hover:border-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-1 focus-visible:outline-white"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">{t("deck.backColors.hint")}</p>
    </div>
  );
};

export default CardBackColorEditor;
