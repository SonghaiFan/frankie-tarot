import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, RefreshCw, Copy, Check } from "lucide-react";
import { SpreadType, PickedCard } from "@/features/tarot/types";
import { SILKY_EASE } from "@/shared/constants/ui";
import { useTranslation } from "react-i18next";
import { Locale } from "@/features/tarot/types";
import { getLocalizedSpread } from "@/features/tarot/constants/spreads";
import type { SavedReadingImage } from '@/host/tarotHost';

interface ReadingSectionProps {
  spread: SpreadType;
  pickedCards: PickedCard[];
  revealedCardIds: Set<number>;
  isObscured: boolean;
  question: string;
  readingText: string;
  briefStatus?: 'idle'|'pending'|'error';
  onRetryBrief?: () => Promise<void>;
  onSaveResult: () => Promise<SavedReadingImage>;
  savesToChat?: boolean;
  onReset: () => void;
  onInterpret?: () => Promise<void>;
  onCopyContext: () => Promise<string>;
}

const ReadingSection: React.FC<ReadingSectionProps> = ({
  spread,
  pickedCards,
  revealedCardIds,
  isObscured,
  question,
  readingText, briefStatus = 'idle', onRetryBrief,
  onSaveResult,
  savesToChat = false,
  onReset,
  onInterpret,
  onCopyContext,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const displayedCards = pickedCards;

  const [isSavingResult, setIsSavingResult] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [savedImage, setSavedImage] = useState<SavedReadingImage>();
  useEffect(()=>{setIsCopied(false);setSavedImage(undefined);},[readingText,question]);

  const handleCopyPrompt = async () => {
    if (onInterpret) {
      if (isSending || isCopied) return;
      setIsSending(true); setSendError("");
      try { await onInterpret(); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000); }
      catch { setSendError(locale === "zh-CN" ? "发送失败，请重试。你的牌阵已保留。" : "Could not send. Your cards are preserved; please retry."); }
      finally { setIsSending(false); }
      return;
    }
    if (isSending) return;
    setIsSending(true); setSendError("");
    try {
      const prompt = await onCopyContext();
      await navigator.clipboard.writeText(prompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to copy reading prompt:", err);
      setSendError(locale === "zh-CN"
        ? "无法复制提示词，请检查浏览器剪贴板权限后重试。"
        : "Could not copy the prompt. Check clipboard permission and try again.");
    } finally { setIsSending(false); }
  };

  const localizedSpread = getLocalizedSpread(spread, locale);
  const nextIndex = pickedCards.findIndex(card => !revealedCardIds.has(card.id));
  const nextLabel = localizedSpread.positions?.[nextIndex]?.label ?? localizedSpread.labels?.[nextIndex];
  const allCardsRevealed = revealedCardIds.size === pickedCards.length;

  const handleSaveResult = async () => {
    if (isSavingResult) return;
    setIsSavingResult(true); setSendError("");
    try { setSavedImage(await onSaveResult()); }
    catch { setSendError(locale === "zh-CN" ? "保存失败，请重试。你的牌阵已保留。" : "Could not save. Your cards are preserved; please retry."); }
    finally { setIsSavingResult(false); }
  };

  return (
    <motion.div
      key="reading-layout"
      className="flex w-full max-w-7xl flex-col items-center px-0 pb-8 pt-8 md:px-8"
      layout
      animate={{
        opacity: isObscured ? 0.14 : 1,
        filter: isObscured ? "blur(10px)" : "blur(0px)",
      }}
      transition={{ duration: 0.42, ease: SILKY_EASE }}
    >
      <div className="flex min-h-[96px] w-full max-w-4xl flex-col items-center justify-center pb-[calc(var(--safe-bottom)+2rem)] text-center md:min-h-[150px]">
        <AnimatePresence mode="wait">
          {!allCardsRevealed ? (
            <motion.div
              key="reveal-prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-neutral-400 text-sm tracking-widest uppercase"
            >
              <span aria-live="polite">{onInterpret && nextIndex >= 0
                ? (locale === "zh-CN" ? `接下来翻开第 ${nextIndex + 1} 张${nextLabel ? ` · ${nextLabel}` : ""}` : `Reveal card ${nextIndex + 1}${nextLabel ? ` · ${nextLabel}` : ""}`)
                : t("reading.revealPrompt")}</span>
            </motion.div>
          ) : (
            <motion.div
              id="reading-content"
              key="text-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: SILKY_EASE }}
              className="relative px-4 md:px-0 w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto flex flex-col items-center"
            >
              <div className="w-full overflow-y-auto overscroll-y-auto mb-8 pr-4 ">
                {question && (
                  <p className="text-xs text-neutral-600 mb-4 tracking-widest uppercase text-center py-2">
                    {t("reading.questionPrefix")} "{question}"
                  </p>
                )}
                <div className="w-12 h-px bg-white/20 mx-auto mb-6" />
                <div className="text-base md:text-xl leading-loose text-neutral-300 font-light font-serif tracking-wide mb-12 text-center">
                  {!readingText && (briefStatus === 'pending' ? (locale === 'zh-CN' ? '正在邀请 ChatGPT，为这组牌写下几句诗意的回声…' : 'Inviting ChatGPT to write a few poetic echoes for these cards…') : briefStatus === 'error' ? (locale === 'zh-CN' ? '简短解读尚未返回，你的牌已保留。' : 'The brief reading has not returned. Your cards are preserved.') : onInterpret
                    ? (locale === "zh-CN" ? "先看看你的牌。准备好后，邀请 ChatGPT 一起解读。" : "Take a moment with your cards. When ready, invite ChatGPT to explore them with you.")
                    : t("reading.webPromptReady"))}
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
                  {onInterpret ? (readingText ? (locale === "zh-CN" ? "点击“解读”，在当前对话里展开更深入的详细分析。" : "Use Explore deeper to explore this reading in the current conversation.") : (locale === "zh-CN" ? "点击下方按钮，将这次问题与牌阵交给当前 ChatGPT 对话。" : "Use the button below to share this question and draw with the current ChatGPT conversation.")) : t("reading.deeperNotice")}
                </p>
              </div>

              {briefStatus === 'error' && !readingText && onRetryBrief && <button onClick={()=>void onRetryBrief()} className="mb-4 text-xs text-neutral-400 underline">{locale === 'zh-CN' ? '重试简短解读' : 'Retry brief reading'}</button>}
              {sendError && <p role="alert" className="text-sm text-red-200 mb-4">{sendError}</p>}
              {savedImage && <p role="status" className="text-xs text-neutral-400 mb-4">
                {savedImage.destination==='library' ? (locale==='zh-CN'?'图片已保存到 ChatGPT 文件库':'Image saved to the ChatGPT file library') : (locale==='zh-CN'?'结果图片已导出':'Reading image exported')}
                {savedImage.downloadUrl && <> · <a href={savedImage.downloadUrl} target="_blank" rel="noopener noreferrer" className="underline">{locale==='zh-CN'?'下载 PNG':'Download PNG'}</a></>}
              </p>}
              <div className="shrink-0 flex flex-col items-center w-full">
                <div className="flex items-center justify-center gap-4 mb-8">
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
                    {onInterpret ? (locale === "zh-CN" ? (isCopied ? "已发送到对话" : isSending ? "正在发送…" : "解读") : (isCopied ? "Sent to chat" : isSending ? "Sending…" : "Interpret")) : (isCopied ? t("reading.copied") : t("reading.copyToChatGPT"))}
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
