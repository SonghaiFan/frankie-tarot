import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, RefreshCw, Copy, Check, ExternalLink } from "lucide-react";
import { SpreadType, PickedCard } from "@/features/tarot/types";
import { SILKY_EASE } from "@/shared/constants/ui";
import { useTranslation } from "react-i18next";
import { Locale } from "@/features/tarot/types";
import { getLocalizedSpread } from "@/features/tarot/constants/spreads";
import StatusToast from "@/shared/components/StatusToast";
import type { SavedReadingImage } from '@/host/tarotHost';

interface ReadingSectionProps {
  isDesktopFit: boolean;
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
  isDesktopFit,
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
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [savedImage, setSavedImage] = useState<SavedReadingImage>();
  useEffect(()=>{setIsCopied(false);setSavedImage(undefined);},[readingText,question]);

  const openPromptIn = async (provider: "chatgpt" | "claude" | "gemini") => {
    if (isSending) return;
    // Open synchronously from the user gesture so popup blockers allow the tab.
    const tab = window.open("about:blank", "_blank");
    setIsProviderMenuOpen(false);
    setIsSending(true);
    setSendError("");
    try {
      const prompt = await onCopyContext();
      const encoded = encodeURIComponent(prompt);
      const url = provider === "chatgpt"
        ? `https://chatgpt.com/?prompt=${encoded}`
        : provider === "claude"
          ? `https://claude.ai/new?q=${encoded}`
          : `https://gemini.google.com/app?prompt=${encoded}`;
      if (provider === "gemini") {
        // Gemini does not document prompt-prefill URLs, so keep the prompt ready to paste too.
        try {
          await navigator.clipboard.writeText(prompt);
          setShowCopiedToast(true);
        } catch {
          // Still open Gemini with the prompt query string as a best-effort prefill.
        }
      }
      if (tab) {
        tab.location.replace(url);
      } else {
        // If popups are blocked, navigate this tab so the requested provider still opens.
        window.location.assign(url);
      }
    } catch (err) {
      tab?.close();
      console.error("Failed to prepare interpretation prompt:", err);
      setSendError(locale === "zh-CN" ? "无法生成提示词，请重试。" : "Could not prepare the prompt. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

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
      setShowCopiedToast(true);
    } catch (err) {
      console.error("Failed to copy reading prompt:", err);
      setSendError(locale === "zh-CN"
        ? "无法复制提示词，请检查浏览器剪贴板权限后重试。"
        : "Could not copy the prompt. Check clipboard permission and try again.");
    } finally { setIsSending(false); }
  };

  useEffect(() => {
    if (!showCopiedToast) return;
    const timer = window.setTimeout(() => setShowCopiedToast(false), 2200);
    return () => window.clearTimeout(timer);
  }, [showCopiedToast]);

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
      className={`flex w-full max-w-7xl flex-col items-center px-0 pb-8 pt-8 md:px-8 ${isDesktopFit ? "lg:absolute lg:inset-x-0 lg:bottom-[calc(var(--safe-bottom)+3.5rem)] lg:z-40 lg:mx-auto lg:grid lg:max-w-4xl lg:grid-cols-[max-content_minmax(0,1fr)_max-content] lg:items-center lg:gap-6 lg:px-0 lg:py-0" : ""}`}
      layout
      animate={{
        opacity: isObscured ? 0.14 : 1,
        filter: isObscured ? "blur(10px)" : "blur(0px)",
      }}
      transition={{ duration: 0.42, ease: SILKY_EASE }}
    >
      <div className={isDesktopFit ? "contents" : "flex min-h-[96px] w-full max-w-4xl flex-col items-center justify-center pb-[calc(var(--safe-bottom)+2rem)] text-center md:min-h-[150px]"}>
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
              className={isDesktopFit ? "contents" : "relative mx-auto flex w-full max-w-2xl flex-col items-center px-4 md:px-0 lg:max-w-4xl xl:max-w-5xl"}
            >
              <div className={`w-full overflow-y-auto overscroll-y-auto pr-4 ${isDesktopFit ? "lg:col-start-2 lg:row-start-1 lg:min-w-0 lg:mb-0 lg:overflow-visible lg:pr-0" : "mb-8"}`}>
                {question && (
                  <p className={`mb-4 py-2 text-center text-xs uppercase tracking-widest text-neutral-600 ${isDesktopFit ? "lg:hidden" : ""}`}>
                    {t("reading.questionPrefix")} "{question}"
                  </p>
                )}
                <div className={`mx-auto h-px w-12 bg-white/20 ${isDesktopFit ? "lg:mb-2" : "mb-6"}`} />
                <div title={readingText || undefined} className={`mb-12 text-center font-serif text-base font-light leading-loose tracking-wide text-neutral-300 md:text-xl ${isDesktopFit ? "lg:mb-0 lg:line-clamp-2 lg:text-sm lg:leading-relaxed" : ""}`}>
                  {!readingText && (briefStatus === 'pending' ? (locale === 'zh-CN' ? '正在邀请 AI，为这组牌写下几句诗意的回声…' : 'Inviting your AI assistant to reflect on these cards…') : briefStatus === 'error' ? (locale === 'zh-CN' ? '简短解读尚未返回，你的牌已保留。' : 'The brief reading has not returned. Your cards are preserved.') : onInterpret
                    ? (locale === "zh-CN" ? "先看看你的牌。准备好后，邀请 AI 一起解读。" : "Take a moment with your cards. When ready, invite your AI assistant to explore them with you.")
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
                {onInterpret && <p className={`mx-auto mb-10 max-w-2xl text-center text-xs leading-relaxed text-neutral-500 md:text-sm ${isDesktopFit ? "lg:hidden" : ""}`}>
                  {readingText ? (locale === "zh-CN" ? "点击“解读”，在当前对话里展开更深入的详细分析。" : "Use Explore deeper to explore this reading in the current conversation.") : (locale === "zh-CN" ? "点击下方按钮，将这次问题与牌阵交给当前对话，一起解读。" : "Use the button below to share this reading with the current conversation.")}
                </p>}
              </div>

              {briefStatus !== 'pending' && !readingText && onRetryBrief && <button onClick={()=>void onRetryBrief()} className={`mb-4 text-xs text-neutral-400 underline ${isDesktopFit ? "lg:absolute lg:bottom-full lg:right-8" : ""}`}>{briefStatus === 'error' ? (locale === 'zh-CN' ? '重试简短解读' : 'Retry brief reading') : (locale === 'zh-CN' ? '简短解读' : 'Brief reading')}</button>}
              {sendError && <p role="alert" className={`mb-4 text-sm text-red-200 ${isDesktopFit ? "lg:absolute lg:bottom-full lg:right-8" : ""}`}>{sendError}</p>}
              {savedImage && <p role="status" className={`mb-4 text-xs text-neutral-400 ${isDesktopFit ? "lg:absolute lg:bottom-full lg:right-8" : ""}`}>
                {savedImage.destination==='library' ? (locale==='zh-CN'?'图片已保存到当前对话的文件库':'Image saved to the current conversation library') : (locale==='zh-CN'?'结果图片已导出':'Reading image exported')}
                {savedImage.downloadUrl && <> · <a href={savedImage.downloadUrl} target="_blank" rel="noopener noreferrer" className="underline">{locale==='zh-CN'?'下载 PNG':'Download PNG'}</a></>}
              </p>}
              <div className={`flex w-full shrink-0 flex-col items-center gap-3 ${isDesktopFit ? "lg:contents" : ""}`}>
                <div className={`relative ${isDesktopFit ? "lg:col-start-3 lg:row-start-1 lg:justify-self-end" : ""}`}>
                  <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.2, duration: 0.3 }}
                    onClick={() => setIsProviderMenuOpen((open) => !open)}
                    className="inline-flex min-w-52 items-center justify-center gap-2 border border-white bg-white px-6 py-3 text-xs font-medium tracking-[0.2em] text-neutral-950 transition-colors hover:border-neutral-200 hover:bg-neutral-200 disabled:cursor-wait disabled:opacity-60"
                    disabled={isSending}
                    aria-haspopup="menu"
                    aria-expanded={isProviderMenuOpen}
                    title={locale === "zh-CN" ? "选择 AI 并打开解读提示词" : "Choose an AI and open the interpretation prompt"}
                  >
                    <ExternalLink size={14} />
                    {isSending ? (locale === "zh-CN" ? "正在打开…" : "Opening…") : (locale === "zh-CN" ? "打开 AI" : "OPEN IN AI")}
                  </motion.button>
                  {isProviderMenuOpen && <div role="menu" className="absolute bottom-full left-1/2 z-30 mb-2 min-w-40 -translate-x-1/2 border border-white/15 bg-neutral-950/95 p-1 shadow-xl backdrop-blur-md">
                    {([
                      ["chatgpt", "ChatGPT"],
                      ["claude", "Claude"],
                      ["gemini", "Gemini"],
                    ] as const).map(([provider, label]) => <button
                      key={provider}
                      type="button"
                      role="menuitem"
                      onClick={() => void openPromptIn(provider)}
                      className="block w-full px-4 py-2 text-left text-xs tracking-wider text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                    >{label}</button>)}
                  </div>}
                </div>

                <div className={`flex flex-wrap items-center justify-center gap-2 ${isDesktopFit ? "lg:col-start-1 lg:row-start-1 lg:justify-self-start" : ""}`}>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.4 }}
                    onClick={handleSaveResult}
                    disabled={isSavingResult || isSending}
                    className="inline-flex items-center gap-2 border border-neutral-800 px-4 py-2 text-xs tracking-[0.12em] text-neutral-500 transition-colors hover:border-white/25 hover:text-neutral-200 disabled:opacity-50"
                    title={t(savesToChat ? "reading.saveToChatTitle" : "reading.saveTitle")}
                  >
                    <Download size={14} />
                    {t(isSavingResult ? "reading.saving" : "reading.save")}
                  </motion.button>

                  {onInterpret && <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.5 }}
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-2 border border-neutral-800 px-4 py-2 text-xs tracking-[0.12em] text-neutral-500 transition-colors hover:border-white/25 hover:text-neutral-200"
                    disabled={isSending || isCopied}
                    title={locale === "zh-CN" ? "在当前对话中解读" : "Interpret in this conversation"}
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    {isCopied ? (locale === "zh-CN" ? "已发送到对话" : "Sent to conversation") : isSending ? (locale === "zh-CN" ? "正在发送…" : "Sending…") : (locale === "zh-CN" ? "当前对话解读" : "Interpret here")}
                  </motion.button>}

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.6 }}
                    onClick={onReset}
                    className="group inline-flex items-center gap-2 border border-neutral-800 px-4 py-2 text-xs tracking-[0.12em] text-neutral-500 transition-colors hover:border-white/25 hover:text-neutral-200"
                  >
                    <RefreshCw size={12} className="transition-transform duration-700 group-hover:rotate-180" />
                    {t("reading.seekAgain")}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <StatusToast open={showCopiedToast} variant="success" title={t("reading.copiedToast")} placement="top" />
    </motion.div>
  );
};

export default ReadingSection;
