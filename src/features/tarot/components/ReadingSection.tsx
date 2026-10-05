import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, RefreshCw, Volume2, Copy, Check } from "lucide-react";
import { SpreadType, PickedCard } from "@/features/tarot/types";
import { SILKY_EASE } from "@/shared/constants/ui";
import { useTranslation } from "react-i18next";
import { Locale } from "@/features/tarot/types";
import buildFollowUpPrompt from "@/features/tarot/utils/buildFollowUpPrompt";

interface ReadingSectionProps {
  spread: SpreadType;
  pickedCards: PickedCard[];
  revealedCardIds: Set<number>;
  isObscured: boolean;
  isThinking: boolean;
  thinkingKeywordIndex: number;
  question: string;
  readingText: string;
  readingAudioBuffer: AudioBuffer | null;
  isAudioPlaying: boolean;
  onReplayAudio: () => void;
  onSaveResult: () => Promise<void>;
  savesToChat?: boolean;
  onReset: () => void;
  onInterpret?: () => Promise<void>;
}

const ReadingSection: React.FC<ReadingSectionProps> = ({
  spread,
  pickedCards,
  revealedCardIds,
  isObscured,
  isThinking,
  thinkingKeywordIndex,
  question,
  readingText,
  readingAudioBuffer,
  isAudioPlaying,
  onReplayAudio,
  onSaveResult,
  savesToChat = false,
  onReset,
  onInterpret,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const displayedCards = pickedCards;

  const [isSavingResult, setIsSavingResult] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyPrompt = async () => {
    if (onInterpret) {
      if (isSending || isCopied) return;
      setIsSending(true); setSendError("");
      try { await onInterpret(); setIsCopied(true); }
      catch { setSendError(locale === "zh-CN" ? "发送失败，请重试。你的牌阵已保留。" : "Could not send. Your cards are preserved; please retry."); }
      finally { setIsSending(false); }
      return;
    }
    const prompt = buildFollowUpPrompt(
      displayedCards,
      spread,
      question,
      readingText,
      locale
    );

    try {
      await navigator.clipboard.writeText(prompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const allCardsRevealed = revealedCardIds.size === pickedCards.length;

  const handleSaveResult = async () => {
    if (isSavingResult) return;
    setIsSavingResult(true); setSendError("");
    try { await onSaveResult(); }
    catch { setSendError(locale === "zh-CN" ? "保存失败，请重试。你的牌阵已保留。" : "Could not save. Your cards are preserved; please retry."); }
    finally { setIsSavingResult(false); }
  };

  const renderThinkingPhrase = () => {
    const phrases = t("reading.thinkingPhrases", { returnObjects: true }) as string[];
    return phrases[thinkingKeywordIndex % phrases.length];
  };

  return (
    <motion.div
      key="reading-layout"
      className="flex w-full max-w-7xl flex-col items-center px-0 pb-8 md:min-h-[100dvh] md:justify-center md:px-8"
      layout
      animate={{
        opacity: isObscured ? 0.14 : 1,
        filter: isObscured ? "blur(10px)" : "blur(0px)",
      }}
      transition={{ duration: 0.42, ease: SILKY_EASE }}
    >
      <div className="flex min-h-[150px] w-full max-w-4xl flex-col items-center justify-center pb-[calc(var(--safe-bottom)+2rem)] text-center">
        <AnimatePresence mode="wait">
          {!allCardsRevealed ? (
            <motion.div
              key="reveal-prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-neutral-400 text-sm tracking-widest uppercase"
            >
              {t("reading.revealPrompt")}
            </motion.div>
          ) : isThinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-8 items-center w-full max-w-xl px-4"
            >
              <div className="h-8 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={thinkingKeywordIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5 }}
                    className="text-xs tracking-[0.3em] text-neutral-400 uppercase"
                  >
                    {renderThinkingPhrase()}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="text-neutral-500"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.3,
                      }}
                    >
                      .
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              id="reading-content"
              key="text-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: SILKY_EASE }}
              className="relative px-4 md:px-0 w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto flex flex-col items-center"
            >
              <div className="w-full overflow-y-auto overscroll-y-auto mb-8 pr-4 ">
                {question && (
                  <p className="text-xs text-neutral-600 mb-4 tracking-widest uppercase text-center sticky top-0 bg-black/90 backdrop-blur-sm py-2 z-10">
                    {t("reading.questionPrefix")} "{question}"
                  </p>
                )}
                <div className="w-12 h-px bg-white/20 mx-auto mb-6" />
                <div className="text-base md:text-xl leading-loose text-neutral-300 font-light font-serif tracking-wide mb-12 text-center">
                  {onInterpret && !readingText && (locale === "zh-CN" ? "先看看你的牌。准备好后，邀请 ChatGPT 一起解读。" : "Take a moment with your cards. When ready, invite ChatGPT to explore them with you.")}
                  {readingText.split("**").map((part, idx) =>
                    idx % 2 === 1 ? (
                      <strong key={idx} className="font-bold text-white/90">
                        {part}
                      </strong>
                    ) : (
                      part
                    )
                  )}
                </div>
                <p className="text-xs md:text-sm text-neutral-500 text-center max-w-2xl mx-auto mb-10 leading-relaxed">
                  {onInterpret ? (locale === "zh-CN" ? "点击下方按钮，将这次问题与牌阵交给当前 ChatGPT 对话。" : "Use the button below to share this question and draw with the current ChatGPT conversation.") : t("reading.deeperNotice")}
                </p>
              </div>

              {sendError && <p role="alert" className="text-sm text-red-200 mb-4">{sendError}</p>}
              <div className="shrink-0 flex flex-col items-center w-full">
                <div className="flex items-center justify-center gap-4 mb-8">
                  {readingAudioBuffer && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2 }}
                      onClick={onReplayAudio}
                      disabled={isAudioPlaying}
                      className="inline-flex items-center gap-2 text-xs tracking-[0.2em] text-neutral-600 hover:text-white transition-colors group px-4 py-2 border border-neutral-800 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t("reading.replayTitle")}
                    >
                      <Volume2
                        size={14}
                        className={isAudioPlaying ? "animate-pulse" : ""}
                      />
                      {t("reading.replay")}
                    </motion.button>
                  )}

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.2 }}
                    onClick={handleSaveResult}
                    disabled={isSavingResult || isSending}
                    className="inline-flex items-center gap-2 text-xs tracking-[0.2em] text-neutral-600 hover:text-white transition-colors group px-4 py-2 border border-neutral-800 hover:border-white/20"
                    title={t(savesToChat ? "reading.saveToChatTitle" : "reading.saveTitle")}
                  >
                    <Download size={14} />
                    {t(isSavingResult ? "reading.saving" : "reading.save")}
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.4 }}
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-2 text-xs tracking-[0.2em] text-neutral-600 hover:text-white transition-colors group px-4 py-2 border border-neutral-800 hover:border-white/20"
                    disabled={isSending || (!!onInterpret && isCopied)}
                    title={onInterpret ? "ChatGPT" : t("reading.promptTitle")}
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    {onInterpret ? (locale === "zh-CN" ? (isCopied ? "已发送到对话" : isSending ? "正在发送…" : "请 ChatGPT 解读") : (isCopied ? "Sent to chat" : isSending ? "Sending…" : "Interpret with ChatGPT")) : (isCopied ? t("reading.copied") : t("reading.prompt"))}
                  </motion.button>
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3 }}
                  onClick={onReset}
                  className="inline-flex items-center gap-3 text-xs tracking-[0.2em] text-neutral-600 hover:text-white transition-colors group px-6 py-2 border border-transparent hover:border-white/10"
                >
                  <RefreshCw
                    size={12}
                    className="group-hover:rotate-180 transition-transform duration-700"
                  />
                  {t("reading.seekAgain")}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ReadingSection;
