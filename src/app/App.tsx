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
import {
  generateTarotReading,
  generateSpeech,
  hasAiKey,
  predictBestSpread,
} from "@/features/tarot/services/gemini";
import { drawCards } from "@/core/tarotEngine";
import type { TarotHost, HostedReading } from "@/host/tarotHost";
import Galaxy from "@/app/components/Galaxy";
import HeaderBar from "@/app/components/HeaderBar";
import IntroSection from "@/features/tarot/components/IntroSection";
import InputSection from "@/features/tarot/components/InputSection";
import PickingSection from "@/features/tarot/components/PickingSection";
import ReadingSection from "@/features/tarot/components/ReadingSection";
import RitualCardStage from "@/features/tarot/components/RitualCardStage";
import DeckLibrary from "@/features/tarot/components/DeckLibrary";
import printTheReading from "@/features/tarot/utils/printTheReading";
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

const App: React.FC<{ host?: TarotHost; initialReading?: HostedReading; initialSetup?: {question: string; spread: SpreadType; revision: number} }> = ({ host, initialReading, initialSetup }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const aiEnabled = !host && hasAiKey();

  const { isMobile, isTablet, isShortViewport } = useResponsive();

  const staticScripts = useMemo(
    () => ({
      WELCOME: t("staticScripts.WELCOME"),
      ASK: t("staticScripts.ASK"),
      PICK: t("staticScripts.PICK"),
      REVEAL: t("staticScripts.REVEAL"),
    }),
    [t]
  );

  const {
    isAudioPlaying,
    audioContextRef,
    hasPlayedIntroWelcomeRef,
    initAudio,
    stopVoice,
    playBuffer,
    playVoice,
    waitForVoiceToFinish,
    playIntroWelcome,
    prefetchStaticAudio,
    startDrone,
    stopDrone,
  } = useTarotAudio(locale, staticScripts);

  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.INTRO);
  const [previousGameState, setPreviousGameState] = useState<GameState | null>(
    null
  );

  // Input State
  const [question, setQuestion] = useState("");
  const [spread, setSpread] = useState<SpreadType | null>(host ? "THREE" : "AUTO");

  // Game Data
  const [pickedCards, setPickedCards] = useState<PickedCard[]>([]);
  const [readingText, setReadingText] = useState<string>("");
  const [readingAudioBuffer, setReadingAudioBuffer] =
    useState<AudioBuffer | null>(null);
  const [revealedCardIds, setRevealedCardIds] = useState<Set<number>>(
    new Set()
  );
  const [hasPlayedReadingAudio, setHasPlayedReadingAudio] = useState(false);

  const [hostError, setHostError] = useState("");

  // System State
  const [isThinking, setIsThinking] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [thinkingKeywordIndex, setThinkingKeywordIndex] = useState(0);
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
  const readingPromiseRef = useRef<Promise<string> | null>(null);
  const readingReadyRef = useRef<boolean>(false);
  const ritualIdRef = useRef<number>(0);
  const predeterminedCardsRef = useRef<PickedCard[]>([]);
  const predeterminedCardsIndexRef = useRef<number>(0);
  const hiddenCardIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!initialReading) return;
    ritualIdRef.current++;
    setQuestion(initialReading.question);
    setSpread(initialReading.spread);
    const picking = initialReading.stage === 'picking';
    setPickedCards(picking ? [] : initialReading.cards);
    predeterminedCardsRef.current = initialReading.cards;
    predeterminedCardsIndexRef.current = 0;
    hiddenCardIdsRef.current.clear();
    setRevealedCardIds(new Set(initialReading.revealedCardIds ?? []));
    setSelectedCardId(null);
    setReadingText(initialReading.interpretation ?? "");
    setIsThinking(false);
    setHostError("");
    setGameState(initialReading.stage === 'picking' ? GameState.PICKING : GameState.READING);
  }, [initialReading?.id, initialReading?.revealedCardIds?.join(','), initialReading?.interpretation]);

  useEffect(() => {
    if (!initialSetup) return;
    ritualIdRef.current++;
    setQuestion(initialSetup.question); setSpread(initialSetup.spread);
    setPickedCards([]); setRevealedCardIds(new Set()); setReadingText("");
    setSelectedCardId(null); setIsThinking(false); setGameState(GameState.INPUT);
  }, [initialSetup?.revision]);

  useEffect(() => {
    if (!host?.reportState) return;
    const timer = setTimeout(() => {
      void host.reportState!({stage:gameState,question,spread,revealedCardIds:[...revealedCardIds],pickedCount:pickedCards.length,cardFaceStyle})
        .then(()=>setHostError(""))
        .catch(()=>setHostError(locale === 'zh-CN' ? '翻牌进度未同步，请再次点击解读重试。' : 'Progress could not sync. Use Interpret to retry.'));
    }, 150);
    return ()=>clearTimeout(timer);
  }, [host,gameState,question,spread,pickedCards.length,[...revealedCardIds].join(','),cardFaceStyle]);

  useEffect(() => {
    if (!isThinking) return;
    const interval = setInterval(() => {
      setThinkingKeywordIndex((prev) => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [isThinking]);

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

    startDrone();
  };

  const startRitual = async () => {
    if (isThinking) return;
    setHostError("");
    let selectedSpread = spread;
    if ((!selectedSpread || selectedSpread === "AUTO") && aiEnabled) {
      setIsThinking(true);
      try {
        selectedSpread = await predictBestSpread(question, locale);
        setSpread(selectedSpread);
      } catch (e) {
        console.error("Spread prediction failed", e);
        selectedSpread = "SINGLE";
        setSpread("SINGLE");
      }
      setIsThinking(false);
    }
    if ((!selectedSpread || selectedSpread === "AUTO") && !aiEnabled) {
      selectedSpread = "SINGLE";
      setSpread("SINGLE");
    }

    if (!selectedSpread) selectedSpread = "SINGLE";

    let targets: PickedCard[];
    if (host) {
      setIsThinking(true);
      try {
        targets = (await host.draw(question, selectedSpread, locale)).cards;
      } catch (error) {
        console.error("Hosted tarot draw failed", error);
        const detail = error instanceof Error ? error.message : String(error);
        setHostError(locale === "zh-CN" ? `抽牌没有完成：${detail}` : `The draw did not complete: ${detail}`);
        return;
      } finally { setIsThinking(false); }
    } else {
      targets = drawCards(selectedSpread);
    }
    setGameState(GameState.PICKING);
    setPickedCards([]);
    setSelectedCardId(null);
    setRevealedCardIds(new Set());
    setHasPlayedReadingAudio(false);
    setReadingText("");
    setReadingAudioBuffer(null);
    hiddenCardIdsRef.current.clear();
    readingReadyRef.current = false;

    const currentRitualId = ritualIdRef.current + 1;
    ritualIdRef.current = currentRitualId;


    predeterminedCardsRef.current = targets;
    predeterminedCardsIndexRef.current = 0;

    targets.forEach((card) => {
      const url = getCardImageUrl(card.image, cardFaceStyle);
      preload(url, { as: "image" });
      const img = new Image();
      img.src = url;
    });

    if (aiEnabled) {
      readingPromiseRef.current = generateTarotReading(
        targets,
        selectedSpread,
        question,
        locale
      )
        .then((text) => {
          if (ritualIdRef.current !== currentRitualId) return text;

          readingReadyRef.current = true;

          if (audioContextRef.current) {
            const sentences = text
              .split(/[。！？.!?]/)
              .filter((s) => s.trim().length > 0);

            const lastSentence =
              sentences.length > 0 ? sentences[sentences.length - 1] : text;

            generateSpeech(
              lastSentence,
              audioContextRef.current,
              undefined,
              locale
            ).then((buffer) => {
              if (ritualIdRef.current === currentRitualId && buffer) {
                setReadingAudioBuffer(buffer);
              }
            });
          }
          return text;
        })
        .catch((err) => {
          console.error("Background generation failed", err);
          return t("errors.silentStars");
        });
    } else {
      readingReadyRef.current = true;
      readingPromiseRef.current = Promise.resolve(
        host ? "" : t("errors.missingApiKeyReading")
      );
    }

    playVoice(staticScripts.PICK, "PICK", "pick");
  };

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
      setTimeout(() => startRevealProcess(newPicked), 1000);
    }
  };

  const startRevealProcess = async (finalCards: PickedCard[]) => {
    setGameState(GameState.READING);
    playVoice(staticScripts.REVEAL, "REVEAL", "reveal");
    if (host) { setReadingText(""); setIsThinking(false); return; }

    if (!readingReadyRef.current) {
      setThinkingKeywordIndex(0);
      setIsThinking(true);
    }

    let text = "";
    if (readingPromiseRef.current) {
      text = await readingPromiseRef.current;
    } else {
      text = await generateTarotReading(finalCards, spread!, question, locale);
    }
    setReadingText(text);
    setIsThinking(false);
  };

  // Play audio when all cards are revealed and audio is ready
  useEffect(() => {
    if (
      gameState === GameState.READING &&
      !isThinking &&
      readingAudioBuffer &&
      pickedCards.length > 0 &&
      revealedCardIds.size === pickedCards.length &&
      !hasPlayedReadingAudio
    ) {
      playBuffer(readingAudioBuffer);
      setHasPlayedReadingAudio(true);
    }
  }, [
    gameState,
    isThinking,
    readingAudioBuffer,
    pickedCards.length,
    revealedCardIds.size,
    hasPlayedReadingAudio,
    playBuffer,
  ]);

  const resetRitual = () => {
    stopVoice();
    setGameState(GameState.INPUT);
    setPickedCards([]);
    setSelectedCardId(null);
    setRevealedCardIds(new Set());
    setHasPlayedReadingAudio(false);
    setReadingText("");
    setReadingAudioBuffer(null);
    setQuestion("");
    setPreviousGameState(null);
    playVoice(staticScripts.ASK, "ASK", "ask");
  };

  const replayAudio = () => {
    if (readingAudioBuffer && !isAudioPlaying) {
      playBuffer(readingAudioBuffer);
    }
  };

  const saveResult = host ? () => host.saveResult(locale, readingText) : printTheReading(
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

  const bgOpacity = gameState === GameState.INTRO ? 0.9 : 0.3;

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
            onSpreadChange={setSpread}
            onStartRitual={startRitual}
            isMobile={isMobile}
            isTablet={isTablet}
            isThinking={isThinking}
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
            isThinking={isThinking}
            thinkingKeywordIndex={thinkingKeywordIndex}
            question={question}
            readingText={readingText}
            readingAudioBuffer={readingAudioBuffer}
            isAudioPlaying={isAudioPlaying}
            onReplayAudio={replayAudio}
            onSaveResult={saveResult}
            savesToChat={!!host}
            onReset={resetRitual}
            onInterpret={host ? () => host.interpret(locale) : undefined}
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
            stopDrone();
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
                  onCardReveal={(id) =>
                    setRevealedCardIds((prev) => new Set(prev).add(id))
                  }
                  onCardHover={setHoveredCardId}
                  onCardFocus={setSelectedCardId}
                  cardBackId={cardBackId}
                  cardFaceStyle={cardFaceStyle}
                />
              )}
            <AnimatePresence mode="sync">{renderPhase()}</AnimatePresence>
          </LayoutGroup>
        </div>
      </motion.main>

      {hostError && <div role="alert" className="fixed bottom-12 inset-x-4 z-[200] text-center text-sm text-red-200">{hostError}</div>}
      {/* Creator Credit */}
      <div className="fixed bottom-[calc(var(--safe-bottom)+0.75rem)] right-[calc(var(--safe-right)+1rem)] md:right-6 z-50 text-[9px] text-neutral-600 font-sans tracking-widest opacity-50 select-none pointer-events-none mix-blend-difference">
        Created by 范松海frank
      </div>
    </div>
  );
};

export default App;
