import { useTranslation } from "react-i18next";
import type { CardBackId } from "../constants/cardBacks";
import { CARD_FRAME_PRESETS, setCardFrame, useCardFrame, type CardFramePreset } from "../hooks/useCardFrame";

export default function CardFrameEditor({ cardBackId }: { cardBackId: CardBackId }) {
  const { t } = useTranslation();
  const { preset } = useCardFrame(cardBackId);
  return <fieldset className="mx-auto mt-6 max-w-3xl border-t border-white/10 pt-5">
    <legend className="px-2 text-[11px] text-neutral-400">{t("deck.frame.title")}</legend>
    <div className="flex flex-wrap gap-3">
      {(Object.keys(CARD_FRAME_PRESETS) as CardFramePreset[]).map(value => <button
        key={value} type="button" aria-pressed={preset === value}
        onClick={() => setCardFrame(cardBackId, value)}
        className={`flex items-center gap-2 border px-3 py-2 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${preset === value ? "border-white/60 text-white" : "border-white/15 text-neutral-500 hover:text-white"}`}
      >
        <span aria-hidden="true" className="block h-7 w-4 rounded-sm border-white bg-black" style={{ borderWidth: CARD_FRAME_PRESETS[value] / 2 }} />
        {t(`deck.frame.${value}`)}
      </button>)}
    </div>
  </fieldset>;
}
