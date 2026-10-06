import { restoreSnapshot } from "@/host/readingSnapshot";
import { preferences } from "@/shared/storage";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { preload } from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  GameState,
  TarotCard,
  SpreadType,
  PickedCard,
  CardPoolType,
  CardFaceStyle,
} from "@/features/tarot/types";
import { DEFAULT_CARD_FACE_STYLE } from "@/features/tarot/constants/cardFaceStyles";
import {
  FULL_DECK,
  getDeckForPool,
  getCardImageUrl,
} from "@/features/tarot/constants/cards";
import { SPREADS } from "@/features/tarot/constants/spreads";
import { drawCards } from "@/core/tarotEngine";
import type { TarotHost, TarotAppSnapshot } from "@/host/tarotHost";
import Galaxy from "@/app/components/Galaxy";
import HeaderBar from "@/app/components/HeaderBar";
import IntroSection from "@/features/tarot/components/IntroSection";
import InputSection from "@/features/tarot/components/InputSection";
import PickingSection from "@/features/tarot/components/PickingSection";
import ReadingSection from "@/features/tarot/components/ReadingSection";
import RitualCardStage from "@/features/tarot/components/RitualCardStage";
import DeckLibrary from "@/features/tarot/components/DeckLibrary";
import printTheReading, { renderReadingImage } from "@/features/tarot/utils/printTheReading";
import { useTarotAudio } from "@/features/tarot/hooks/useTarotAudio";
import { useResponsive } from "@/shared/hooks/useResponsive";
import { useTranslation } from "react-i18next";
import { Locale } from "@/i18n/types";
import { CardBackId, DEFAULT_CARD_BACK_ID } from "@/features/tarot/constants/cardBacks";
import {
  CardPack,
  DEFAULT_CARD_PACK_ID,
  findPackByCombination,
} from "@/features/tarot/constants/cardPacks";

const App: React.FC<{ host?: TarotHost; initialSnapshot?: TarotAppSnapshot; briefSummary?: {readingId:string;text:string}; initialSetup?: {question: string; spread: SpreadType; revision: number; autoStart?: boolean} }> = ({ host, initialSnapshot, initialSetup, briefSummary }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;

  const { isMobile, isTablet, isShortViewport } = useResponsive();

  const {
    isAudioPlaying,
    hasPlayedIntroWelcomeRef,
    initAudio,
    stopVoice,
    playVoice,
    waitForVoiceToFinish,
    playIntroWelcome,
    prefetchStaticAudio,
  } = useTarotAudio(locale);

  const [savedReading] = useState(() => {
    if (host) return initialSnapshot;
    try { return restoreSnapshot(JSON.parse(sessionStorage.getItem('f-tarot-reading') ?? 'null')); }
    catch { return undefined; }
  });
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(savedReading?.stage ?? GameState.INTRO);
  const [previousGameState, setPreviousGameState] = useState<GameState | null>(
    null
  );

  // Input State
  const [question, setQuestion] = useState(savedReading?.question ?? "");
  const [spread, setSpread] = useState<SpreadType | null>(savedReading?.spread ?? (host ? "THREE" : "SINGLE"));

  // Game Data
  const [pickedCards, setPickedCards] = useState<PickedCard[]>(savedReading?.pickedCards ?? []);
  const [readingText, setReadingText] = useState<string>(savedReading?.readingText ?? "");
  const [revealedCardIds, setRevealedCardIds] = useState<Set<number>>(
    new Set(savedReading?.revealedCardIds)
  );

  const [briefStatus,setBriefStatus] = useState<'idle'|'pending'|'error'>('idle');
  const [hostError, setHostError] = useState("");

  // System State
  const [isThinking, setIsThinking] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardBackId, setCardBackId] = useState<CardBackId>(() => {
    const savedCardBack = preferences.getItem("f-tarot-card-back");
    return savedCardBack === "celestial-compass" ||
      savedCardBack === "eclipse-nocturne" ||
      savedCardBack === "thorn-bloom" ||
      savedCardBack === "sacred-geometry"
      ? savedCardBack
      : "eclipse-nocturne";
  });

  const [cardFaceStyle, setCardFaceStyle] = useState<CardFaceStyle>(() => {
    if (savedReading) return savedReading.cardFaceStyle;
    const saved = preferences.getItem("f-tarot-card-face-style");
    return saved === "original" || saved === "redraw" || saved === "dreamy"
      ? saved
      : "dreamy";
  });

  const [cardPackId, setCardPackId] = useState<string>(() => {
    const saved = preferences.getItem("f-tarot-card-pack");
    return saved || DEFAULT_CARD_PACK_ID;
  });

  const handleSelectPack = (pack: CardPack) => {
    setCardPackId(pack.id);
    setCardFaceStyle(pack.cardFaceStyle);
    setCardBackId(pack.cardBackId);
    preferences.setItem("f-tarot-card-pack", pack.id);
    preferences.setItem("f-tarot-card-face-style", pack.cardFaceStyle);
    preferences.setItem("f-tarot-card-back", pack.cardBackId);
  };

  const handleCardFaceStyleChange = (style: CardFaceStyle) => {
    setCardFaceStyle(style);
    const matched = findPackByCombination(style, cardBackId);
    const newPackId = matched ? matched.id : "custom";
    setCardPackId(newPackId);
    preferences.setItem("f-tarot-card-pack", newPackId);
  };

  const handleCardBackChange = (back: CardBackId) => {
    setCardBackId(back);
    const matched = findPackByCombination(cardFaceStyle, back);
    const newPackId = matched ? matched.id : "custom";
    setCardPackId(newPackId);
    preferences.setItem("f-tarot-card-pack", newPackId);
  };

  // --- Refs ---
  const predeterminedCardsRef = useRef<PickedCard[]>(savedReading?.drawTargets ?? []);
  const predeterminedCardsIndexRef = useRef<number>(savedReading?.pickedCards.length ?? 0);
  const hiddenCardIdsRef = useRef<Set<number>>(new Set(savedReading?.pickedCards.map(card => card.visualId ?? card.id)));
  const summaryRequestedRef = useRef<string | undefined>(savedReading?.summaryRequested ? savedReading.readingId : undefined);
  const readingIdRef = useRef<string | undefined>(savedReading?.readingId);

  useEffect(() => {
    if (!initialSetup) return;
    summaryRequestedRef.current = undefined;setBriefStatus('idle');
    readingIdRef.current = undefined;
    predeterminedCardsRef.current = [];
    predeterminedCardsIndexRef.current = 0;
    hiddenCardIdsRef.current.clear();
    setQuestion(initialSetup.question); setSpread(initialSetup.spread);
    setPickedCards([]); setRevealedCardIds(new Set()); setReadingText("");
    setSelectedCardId(null); setIsThinking(false); setGameState(GameState.INPUT);
  }, [initialSetup?.revision]);

  useEffect(() => {
    if (!initialSnapshot) return;
    summaryRequestedRef.current = initialSnapshot.summaryRequested ? initialSnapshot.readingId : undefined;
    setBriefStatus(initialSnapshot.summaryRequested && !initialSnapshot.readingText ? 'pending' : 'idle');
    readingIdRef.current = initialSnapshot.readingId;
    setQuestion(initialSnapshot.question);
    setSpread(initialSnapshot.spread);
    setPickedCards(initialSnapshot.pickedCards);
    predeterminedCardsRef.current = initialSnapshot.drawTargets;
    predeterminedCardsIndexRef.current = initialSnapshot.pickedCards.length;
    hiddenCardIdsRef.current = new Set(initialSnapshot.pickedCards.map(card => card.visualId ?? card.id));
    setRevealedCardIds(new Set(initialSnapshot.revealedCardIds));
    setCardFaceStyle(initialSnapshot.cardFaceStyle);
    setSelectedCardId(null); setReadingText(initialSnapshot.readingText ?? ''); setIsThinking(false);
    setGameState(initialSnapshot.stage);
    if (initialSnapshot.stage === GameState.PICKING && initialSnapshot.spread &&
      initialSnapshot.pickedCards.length === SPREADS[initialSnapshot.spread].cardCount) {
      setGameState(GameState.READING);
    }
  }, [initialSnapshot]);

  useEffect(() => {
    const state: TarotAppSnapshot = {version:1,readingId:readingIdRef.current,
      stage:gameState === GameState.LIBRARY ? previousGameState ?? GameState.INTRO : gameState,
      question,spread,pickedCards,readingText,
      summaryRequested:!!readingIdRef.current && summaryRequestedRef.current===readingIdRef.current,
      drawTargets:predeterminedCardsRef.current,revealedCardIds:[...revealedCardIds],cardFaceStyle};
    if (host?.reportState) {
      void host.reportState(state).catch(()=>setHostError(locale === 'zh-CN' ? '牌局状态未保存，请重试。' : 'Could not save this table state. Please retry.'));
    } else if (!host) {
      try { sessionStorage.setItem('f-tarot-reading',JSON.stringify(state)); } catch { /* Storage may be unavailable. */ }
    }
  }, [host,gameState,previousGameState,question,spread,pickedCards,[...revealedCardIds].join(','),cardFaceStyle,readingText,briefStatus]);

  const attachCardContext = (id: number) => {
    const position = pickedCards.findIndex(card => card.id === id);
    if (!host?.attachCard || !spread || position < 0) return;
    void host.attachCard({question,spread,card:pickedCards[position],position:position + 1,locale})
      .then(()=>setHostError(''))
      .catch(()=>setHostError(locale === 'zh-CN' ? '卡牌上下文未发送，请再次点击卡牌重试。' : 'Could not attach this card. Click it again to retry.'));
  };

  useEffect(() => {
    preferences.setItem("f-tarot-card-back", cardBackId);
  }, [cardBackId]);

  useEffect(() => {
    preferences.setItem("f-tarot-card-face-style", cardFaceStyle);
  }, [cardFaceStyle]);

  // --- Computed Deck ---
  const activeDeck = useMemo(() => {
    if (!spread) return FULL_DECK;

    const spreadDef = SPREADS[spread];

    if (pickedCards.length >= spreadDef.cardCount) {
      return [];
    }

    const currentStep = pickedCards.length;
    let poolType: CardPoolType = "FULL";
    if (spreadDef.cardPools && spreadDef.cardPools[currentStep]) {
      poolType = spreadDef.cardPools[currentStep];
    }

    return getDeckForPool(poolType);
  }, [spread, pickedCards.length]);

  // --- Flow Handlers ---
  const enterInputPhase = async () => {
    initAudio();
    setGameState(GameState.INPUT);
    prefetchStaticAudio();

    if (!hasPlayedIntroWelcomeRef.current) {
      await playIntroWelcome();
    } else {
      await waitForVoiceToFinish();
    }

  };

  const startRitual = async () => {
    if (isThinking) return;
    setHostError("");
    if (spread === 'AUTO' && host?.requestSpread) {
      setIsThinking(true);
      try { await host.requestSpread(question, locale); }
      catch {
        setIsThinking(false);
        setHostError(locale === 'zh-CN' ? '智能牌阵请求未发送，请重试。' : 'Could not request a smart spread. Please retry.');
      }
      return;
    }
    const selectedSpread = !spread || spread === "AUTO" ? "SINGLE" : spread;
    if (selectedSpread !== spread) setSpread(selectedSpread);
    const targets = drawCards(selectedSpread);
    readingIdRef.current = crypto.randomUUID();
    setGameState(GameState.PICKING);
    setPickedCards([]);
    setSelectedCardId(null);
    setRevealedCardIds(new Set());
    setReadingText("");
    hiddenCardIdsRef.current.clear();

    predeterminedCardsRef.current = targets;
    predeterminedCardsIndexRef.current = 0;

    targets.forEach((card) => {
      const url = getCardImageUrl(card.image, cardFaceStyle);
      preload(url, { as: "image" });
      const img = new Image();
      img.src = url;
    });

    playVoice("PICK", "pick");
  };


  const autoStartedRevisionRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!initialSetup?.autoStart || autoStartedRevisionRef.current === initialSetup.revision ||
      gameState !== GameState.INPUT || isThinking || question !== initialSetup.question || spread !== initialSetup.spread) return;
    autoStartedRevisionRef.current = initialSetup.revision;
    void startRitual();
  }, [initialSetup,gameState,isThinking,question,spread]);

  useEffect(() => {
    if (briefSummary && briefSummary.readingId === readingIdRef.current) {
      setReadingText(briefSummary.text);setBriefStatus('idle');
    }
  }, [briefSummary]);

  const requestBriefSummary = async () => {
    if (!host?.summarize || !spread || !readingIdRef.current) return;
    summaryRequestedRef.current = readingIdRef.current;setBriefStatus('pending');
    try { await host.summarize({readingId:readingIdRef.current,question,spread,cards:pickedCards,revealedCardIds:[...revealedCardIds],locale}); }
    catch { setBriefStatus('error'); }
  };
  useEffect(() => {
    if (!host?.summarize || gameState !== GameState.READING || !spread || !pickedCards.length ||
      pickedCards.length !== SPREADS[spread].cardCount ||
      !pickedCards.every(card=>revealedCardIds.has(card.id)) ||
      !readingIdRef.current || summaryRequestedRef.current === readingIdRef.current) return;
    void requestBriefSummary();
  }, [host,gameState,spread,pickedCards,revealedCardIds]);
  useEffect(() => {
    if (briefStatus !== 'pending' || readingText) return;
    const timer=setTimeout(()=>setBriefStatus('error'),60000);
    return ()=>clearTimeout(timer);
  },[briefStatus,readingText]);

  const handleCardSelect = async (visualCard: TarotCard) => {
    if (isThinking || gameState !== GameState.PICKING) return;

    const requiredCards = SPREADS[spread!].cardCount;
    if (pickedCards.length >= requiredCards) return;

    if (hiddenCardIdsRef.current.has(visualCard.id)) return;

    const targetIndex = predeterminedCardsIndexRef.current;
    if (targetIndex >= predeterminedCardsRef.current.length) return;

    const targetCard = predeterminedCardsRef.current[targetIndex];
    predeterminedCardsIndexRef.current++;

    const hybridCard: PickedCard = {
      ...targetCard,
      visualId: visualCard.id,
    };

    hiddenCardIdsRef.current.add(visualCard.id);

    const newPicked: PickedCard[] = [...pickedCards, hybridCard];
    setPickedCards(newPicked);

    if (newPicked.length === requiredCards) {
      // Request expansion directly from the final user selection.
      void host?.expand?.().catch(() => {});
      setTimeout(startRevealProcess, 1000);
    }
  };

  const startRevealProcess = () => {
    setGameState(GameState.READING);
    playVoice("REVEAL", "reveal");
    setReadingText("");
    setIsThinking(false);
  };

  const resetRitual = () => {
    stopVoice();
    setGameState(GameState.INPUT);
    setPickedCards([]);
    setSelectedCardId(null);
    setRevealedCardIds(new Set());
    setReadingText("");
    setQuestion("");
    summaryRequestedRef.current = undefined;setBriefStatus('idle');
    readingIdRef.current = undefined;
    predeterminedCardsRef.current = [];
    setIsThinking(false);
    setPreviousGameState(null);
    playVoice("ASK", "ask");
  };

  const saveResult = host ? async () => host.saveResult(locale, readingText, await renderReadingImage({
    question, spread:spread!, pickedCards, readingText, locale, cardFaceStyle
  })) : printTheReading(
    question,
    spread!,
    pickedCards,
    readingText,
    locale,
    cardFaceStyle
  );

  const toggleLibrary = () => {
    setSelectedCardId(null);
    if (gameState === GameState.LIBRARY) {
      if (previousGameState) {
        setGameState(previousGameState);
        setPreviousGameState(null);
      } else {
        setGameState(GameState.INTRO);
      }
    } else {
      setPreviousGameState(gameState);
      setGameState(GameState.LIBRARY);
    }
  };

  // The intro draws its own turning night sky, so the galaxy rests there.
  const bgOpacity = gameState === GameState.INTRO ? 0 : 0.3;

  const renderPhase = () => {
    switch (gameState) {
      case GameState.INTRO:
        return <IntroSection onEnter={enterInputPhase} />;
      case GameState.LIBRARY:
        return (
          <DeckLibrary
            selectedCardId={selectedCardId}
            isMobile={isMobile}
            isTablet={isTablet}
            onCardFocus={setSelectedCardId}
            cardBackId={cardBackId}
            onCardBackChange={handleCardBackChange}
            cardFaceStyle={cardFaceStyle}
            onCardFaceStyleChange={handleCardFaceStyleChange}
            cardPackId={cardPackId}
            onSelectPack={handleSelectPack}
          />
        );
      case GameState.INPUT:
        return (
          <InputSection
            question={question}
            spread={spread}
            onQuestionChange={setQuestion}
            onSpreadChange={(value) => {setSpread(value);setIsThinking(false);}}
            onStartRitual={startRitual}
            isMobile={isMobile}
            isTablet={isTablet}
            isThinking={isThinking}
            smartSpread={spread === "AUTO" && !!host?.requestSpread}
          />
        );
      case GameState.PICKING:
        return (
          <PickingSection
            spread={spread}
            activeDeck={activeDeck}
            pickedCards={pickedCards}
            isMobile={isMobile}
            isTablet={isTablet}
            hoveredCardId={hoveredCardId}
            onCardHover={setHoveredCardId}
            onCardSelect={handleCardSelect}
            cardBackId={cardBackId}
          />
        );
      case GameState.REVEAL:
      case GameState.READING:
        if (!pickedCards.length) return null;
        return (
          <ReadingSection
            spread={spread}
            pickedCards={pickedCards}
            revealedCardIds={revealedCardIds}
            isObscured={selectedCardId !== null}
            question={question}
            readingText={readingText}
            briefStatus={briefStatus}
            onRetryBrief={host?.summarize ? requestBriefSummary : undefined}
            onSaveResult={saveResult}
            savesToChat={!!host}
            onReset={resetRitual}
            onInterpret={host ? () => host.interpret({question,spread:spread!,cards:pickedCards,revealedCardIds:[...revealedCardIds],locale}) : undefined}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] bg-black text-neutral-200 font-serif select-none cursor-default overflow-hidden">
      {/* Galaxy Background (Persistent) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: bgOpacity }}
        transition={{ duration: 2 }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <Galaxy
          speed={
            gameState === GameState.PICKING
              ? 0.2
              : gameState === GameState.READING
              ? 0.15
              : gameState === GameState.REVEAL
              ? 0.8
              : 1.0
          }
          hueShift={260}
          saturation={
            hoveredCardId !== null && gameState === GameState.READING
              ? 0.9
              : 0.15
          }
          density={1.05}
          glowIntensity={
            hoveredCardId !== null && gameState === GameState.READING
              ? 0.5
              : 0.22
          }
          twinkleIntensity={0.18}
          rotationSpeed={0.08}
          mouseRepulsion={false}
          mouseInteraction={false}
          transparent={true}
        />
      </motion.div>

      {/* Header */}
      <motion.div
        animate={{
          opacity: selectedCardId === null ? 1 : 0,
          filter: selectedCardId === null ? "blur(0px)" : "blur(8px)",
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-[60] ${
          selectedCardId === null ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <HeaderBar
          gameState={gameState === GameState.READING && revealedCardIds.size < pickedCards.length ? GameState.REVEAL : gameState}
          isAudioPlaying={isAudioPlaying}
          pickingCount={spread ? SPREADS[spread].cardCount : 0}
          pickedCount={pickedCards.length}
          onLibraryClick={toggleLibrary}
          onExpand={host?.expand}
          onHomeClick={() => {
            setSelectedCardId(null);
            setGameState(GameState.INTRO);
            setPreviousGameState(null);
          }}
        />
      </motion.div>

      {/* Main content uses the dynamic viewport so mobile browser chrome does not
          steal space from fixed-height layouts. */}
      <motion.main
        layoutScroll
        className={`absolute inset-0 ${selectedCardId !== null ? "z-[100]" : "z-10"} h-[100dvh] overflow-hidden overscroll-y-contain ${
          gameState === GameState.READING ||
          gameState === GameState.REVEAL ||
          gameState === GameState.INPUT ||
          gameState === GameState.LIBRARY
            ? "overflow-y-auto"
            : "overflow-hidden"
        }`}
      >
        {/* Scrollable phases start below the safe-area header instead of being
            vertically forced into a viewport that may be shorter than content. */}
        <div
          className={`relative w-full flex flex-col items-center px-4 ${
            gameState === GameState.READING ||
            gameState === GameState.REVEAL
              ? "min-h-full pt-[calc(var(--safe-top)+1rem)] pb-[calc(var(--safe-bottom)+3rem)] justify-start"
              : gameState === GameState.INPUT ||
                gameState === GameState.LIBRARY
              ? "min-h-full pt-[calc(var(--safe-top)+4.5rem)] pb-[calc(var(--safe-bottom)+3rem)] justify-start md:justify-center"
              : "h-full justify-center pt-[calc(var(--safe-top)+4rem)] pb-[calc(var(--safe-bottom)+2rem)]"
          }`}
        >
          <LayoutGroup id="ritual-cards">
            {(gameState === GameState.PICKING ||
              gameState === GameState.REVEAL ||
              gameState === GameState.READING) &&
              spread && (
                <RitualCardStage
                  gameState={gameState}
            spread={spread}
                  pickedCards={pickedCards}
                  revealedCardIds={revealedCardIds}
                  hoveredCardId={hoveredCardId}
                  selectedCardId={selectedCardId}
                  isMobile={isMobile}
                  isTablet={isTablet}
                  isShortViewport={isShortViewport}
                  onCardReveal={(id) => {
                    setRevealedCardIds((prev) => new Set(prev).add(id));
                    attachCardContext(id);
                  }}
                  onCardHover={setHoveredCardId}
                  onCardFocus={(id) => {
                    setSelectedCardId(id);
                    if (id !== null && revealedCardIds.has(id)) attachCardContext(id);
                  }}
                  cardBackId={cardBackId}
                  cardFaceStyle={cardFaceStyle}
                />
              )}
            <AnimatePresence mode="sync">{renderPhase()}</AnimatePresence>
          </LayoutGroup>
        </div>
      </motion.main>

      {hostError && <div role="alert" className="fixed bottom-12 inset-x-4 z-[200] text-center text-sm text-red-200">{hostError}</div>}
      {/* Creator Credit (the intro carries its own) */}
      {gameState !== GameState.INTRO && <div className="fixed bottom-[calc(var(--safe-bottom)+0.75rem)] right-[calc(var(--safe-right)+1rem)] md:right-6 z-50 text-[9px] text-neutral-600 font-sans tracking-widest opacity-50 select-none pointer-events-none mix-blend-difference">
        Created by 范松海frank
      </div>}
    </div>
  );
};

export default App;
