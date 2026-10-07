import {
  Library,
  ArrowLeft,
  Languages,
  Maximize2,
  Minimize2,
} from "lucide-react";
import React, { useState } from "react";
import AudioVisualizer from "./AudioVisualizer";
import FrankSignature from "./FrankSignature";
import { GameState } from "@/features/tarot/types";
import { useTranslation } from "react-i18next";
import { Locale } from "@/features/tarot/types";

interface HeaderBarProps {
  gameState: GameState;
  isAudioPlaying: boolean;
  pickingCount?: number;
  pickedCount?: number;
  onLibraryClick: () => void;
  onHomeClick: () => void;
  onExpand?: () => Promise<void>;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  gameState,
  isAudioPlaying,
  pickingCount = 0,
  pickedCount = 0,
  onLibraryClick,
  onHomeClick,
  onExpand,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleLocale = () => {
    i18n.changeLanguage(locale === "en" ? "zh-CN" : "en");
  };

  const handleFullscreen = () => {
    if (onExpand) { void onExpand().catch(() => {}); return; }
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };
  const getStateLabel = () => {
    return t(`header.stateLabels.${gameState}`) || "";
  };

  return (
    // On phones the top edge belongs to the notch or a host's bar and the
    // bottom to the thumb, so the header docks at the bottom, above the safe
    // area. The home page carries these controls itself there.
    <header className={`${gameState === GameState.INTRO ? "max-md:hidden " : ""}fixed left-0 right-0 z-40 flex min-h-12 items-center justify-between from-black/90 via-black/35 to-transparent pl-[calc(var(--safe-left)+1rem)] pr-[calc(var(--safe-right)+1rem)] pointer-events-none max-md:bottom-0 max-md:bg-linear-to-t max-md:pb-[calc(var(--safe-bottom)+0.5rem)] max-md:pt-6 md:top-0 md:min-h-16 md:bg-linear-to-b md:px-8 md:pt-[var(--safe-top)]`}>
      {/* Left: Logo / Home */}
      <div className="flex items-center gap-3 md:gap-6 pointer-events-auto">
        <button onClick={onHomeClick} className="flex flex-col gap-1 group">
          <div className="flex items-center gap-3 text-white/85 group-hover:text-white transition-colors md:gap-4">
            <FrankSignature className="h-6 w-auto md:h-8" />
            <h1 className="hidden sm:block pt-1 font-display text-[13px] font-light tracking-[0.5em] md:text-[15px]">
              TAROT
            </h1>
          </div>
        </button>

        {/* State Breadcrumb */}
        {gameState !== GameState.INTRO && (
          <div className="hidden md:flex items-center gap-2 text-neutral-500 text-[10px] tracking-widest uppercase animate-in fade-in slide-in-from-left-4">
            <span className="w-px h-4 bg-white/10" />
            <span>{getStateLabel()}</span>
          </div>
        )}
      </div>

      {gameState === GameState.PICKING && pickingCount > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-[calc(var(--safe-top)+1rem)] flex -translate-x-1/2 flex-col items-center gap-1 text-center md:top-[calc(var(--safe-top)+4.5rem)]">
          <p className="whitespace-nowrap text-[10px] text-neutral-300 md:text-xs">
            {t("picking.instruction", { count: pickingCount })}
          </p>
          <div className="flex justify-center gap-2" aria-label={`${pickedCount} of ${pickingCount} cards selected`}>
            {Array.from({ length: pickingCount }).map((_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rotate-45 border border-white/30 transition-all duration-500 md:h-2.5 md:w-2.5 ${
                  index < pickedCount
                    ? "scale-110 bg-white"
                    : "scale-90 bg-transparent"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Right: Controls */}
      <div className="flex items-center gap-1 pointer-events-auto md:gap-2">
        <div className="hidden h-9 w-9 items-center justify-center sm:flex" aria-hidden="true">
          <AudioVisualizer isPlaying={isAudioPlaying} />
        </div>
        <button
          type="button"
          onClick={toggleLocale}
          className="flex h-9 w-9 items-center justify-center border border-transparent text-white/50 transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
          title={locale === "en" ? t("header.switchToChinese") : t("header.switchToEnglish")}
          aria-label={locale === "en" ? t("header.switchToChinese") : t("header.switchToEnglish")}
        >
          <Languages size={17} />
        </button>
        <button
          type="button"
          onClick={onLibraryClick}
          className={`flex h-9 w-9 items-center justify-center border text-white/50 transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-white ${
            gameState === GameState.LIBRARY
              ? "border-white/15 bg-white/[0.04] text-white"
              : "border-transparent"
          }`}
          title={
            gameState === GameState.LIBRARY
              ? t("header.closeLibraryTitle")
              : t("header.openLibraryTitle")
          }
          aria-label={
            gameState === GameState.LIBRARY
              ? t("header.closeLibraryTitle")
              : t("header.openLibraryTitle")
          }
        >
          {gameState === GameState.LIBRARY ? (
            <ArrowLeft size={17} />
          ) : (
            <Library size={17} />
          )}
        </button>
        <button
          type="button"
          onClick={handleFullscreen}
          className="hidden h-9 w-9 items-center justify-center border border-transparent text-white/50 transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-white sm:flex"
          title={
            isFullscreen
              ? t("header.exitFullscreen")
              : t("header.fullscreen")
          }
          aria-label={
            isFullscreen
              ? t("header.exitFullscreen")
              : t("header.fullscreen")
          }
        >
          {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
    </header>
  );
};

export default HeaderBar;
